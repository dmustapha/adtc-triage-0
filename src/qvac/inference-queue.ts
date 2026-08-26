import { randomUUID } from "node:crypto";

export type JobKind = "triage" | "assist" | "debug" | "prewarm" | string;
export type JobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "disconnected";

export interface PublicJobStatus {
  id: string;
  kind: JobKind;
  state: JobState;
  position: number | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  nativeSettled: boolean;
}

export interface JobContext {
  signal: AbortSignal;
  publish(effect: () => void): boolean;
  isPublishable(): boolean;
}

export type JobRunner<T> = (context: JobContext) => Promise<T>;

export interface SubmitOptions {
  deadlineMs?: number;
  label?: string;
}

export interface SubmittedJob<T> {
  id: string;
  position: number;
  promise: Promise<T>;
  disconnect(): boolean;
}

export interface CancelResult {
  ok: boolean;
  state?: "cancelled";
}

export interface ShutdownResult {
  drained: boolean;
  activeJobId: string | null;
  pendingCancelled: number;
}

export class QueueSaturatedError extends Error {
  constructor() {
    super("Inference queue is full. Retry after the active work completes.");
    this.name = "QueueSaturatedError";
  }
}

export class QueueClosedError extends Error {
  constructor() {
    super("Inference queue is shutting down and cannot accept new work.");
    this.name = "QueueClosedError";
  }
}

export class QueueRecoveryRequiredError extends Error {
  constructor() {
    super("Native inference did not stop after cancellation. Restart the local app before retrying.");
    this.name = "QueueRecoveryRequiredError";
  }
}

export class JobCancelledError extends Error {
  constructor() {
    super("Inference job was cancelled.");
    this.name = "JobCancelledError";
  }
}

export class JobDisconnectedError extends Error {
  constructor() {
    super("Inference job owner disconnected.");
    this.name = "JobDisconnectedError";
  }
}

export class JobTimedOutError extends Error {
  constructor(label: string, deadlineMs: number) {
    super(`${label} timed out after ${deadlineMs}ms`);
    this.name = "JobTimedOutError";
  }
}

export interface QueueOptions {
  maxPending?: number;
  maxRetained?: number;
  idFactory?: () => string;
  now?: () => number;
  onTerminal?: (status: PublicJobStatus) => void;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  clearScheduled?: (handle: unknown) => void;
  nativeCancelGraceMs?: number;
}

interface InternalJob {
  id: string;
  owner: string;
  kind: JobKind;
  state: JobState;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  nativeSettled: boolean;
  controller: AbortController;
  publishable: boolean;
  terminalPublished: boolean;
  runner: JobRunner<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  promise: Promise<unknown>;
  options: SubmitOptions;
  deadlineTimer?: unknown;
  nativeStallTimer?: unknown;
  nativeDone: Promise<void>;
  resolveNativeDone: () => void;
}

export class InferenceQueue {
  readonly #maxPending: number;
  readonly #maxRetained: number;
  readonly #idFactory: () => string;
  readonly #now: () => number;
  readonly #onTerminal?: (status: PublicJobStatus) => void;
  readonly #schedule: (callback: () => void, delayMs: number) => unknown;
  readonly #clearScheduled: (handle: unknown) => void;
  readonly #nativeCancelGraceMs: number;
  readonly #jobs = new Map<string, InternalJob>();
  readonly #pending: InternalJob[] = [];
  #active: InternalJob | null = null;
  #accepting = true;
  #recoveryRequired = false;

  constructor(options: QueueOptions = {}) {
    this.#maxPending = options.maxPending ?? 4;
    this.#maxRetained = options.maxRetained ?? 100;
    if (!Number.isInteger(this.#maxPending) || this.#maxPending < 0) {
      throw new RangeError("maxPending must be a non-negative integer.");
    }
    if (!Number.isInteger(this.#maxRetained) || this.#maxRetained < 0) {
      throw new RangeError("maxRetained must be a non-negative integer.");
    }
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#now = options.now ?? Date.now;
    this.#onTerminal = options.onTerminal;
    this.#schedule = options.schedule ?? ((callback, delayMs) => {
      const timer = setTimeout(callback, delayMs);
      timer.unref?.();
      return timer;
    });
    this.#clearScheduled = options.clearScheduled ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.#nativeCancelGraceMs = options.nativeCancelGraceMs ?? 5_000;
    if (!Number.isFinite(this.#nativeCancelGraceMs) || this.#nativeCancelGraceMs < 0) {
      throw new RangeError("nativeCancelGraceMs must be a non-negative finite number.");
    }
  }

  get size(): number {
    return this.#pending.length + (this.#active ? 1 : 0);
  }

  get recoveryRequired(): boolean {
    return this.#recoveryRequired;
  }

  submit<T>(owner: string, kind: JobKind, run: JobRunner<T>, options: SubmitOptions = {}): SubmittedJob<T> {
    if (!this.#accepting) throw new QueueClosedError();
    if (this.#recoveryRequired) throw new QueueRecoveryRequiredError();
    if (this.#active && this.#pending.length >= this.#maxPending) throw new QueueSaturatedError();

    const job = this.#makeJob(owner, kind, run, options);
    this.#jobs.set(job.id, job);
    const position = this.#active ? this.#pending.push(job) : 0;
    if (!this.#active) this.#start(job);
    return {
      id: job.id,
      position,
      promise: job.promise as Promise<T>,
      disconnect: () => this.#disconnect(job.id, owner),
    };
  }

  cancel(jobId: string, owner: string): CancelResult {
    const job = this.#ownedJob(jobId, owner);
    if (!job || this.#isTerminal(job)) return { ok: false };
    this.#removePending(job);
    job.controller.abort(new JobCancelledError());
    this.#finishPublic(job, "cancelled", new JobCancelledError());
    if (job !== this.#active) this.#settleNeverStarted(job);
    return { ok: true, state: "cancelled" };
  }

  status(jobId: string, owner: string): PublicJobStatus | null {
    const job = this.#ownedJob(jobId, owner);
    return job ? this.#publicStatus(job) : null;
  }

  async shutdown(graceMs: number): Promise<ShutdownResult> {
    this.#accepting = false;
    const pending = [...this.#pending];
    for (const job of pending) this.cancel(job.id, job.owner);
    const pendingCancelled = pending.length;
    const active = this.#active;
    if (!active) return { drained: true, activeJobId: null, pendingCancelled };

    this.cancel(active.id, active.owner);
    const drained = await this.#waitForNative(active, graceMs);
    return {
      drained,
      activeJobId: drained ? null : active.id,
      pendingCancelled,
    };
  }

  #makeJob<T>(owner: string, kind: JobKind, runner: JobRunner<T>, options: SubmitOptions): InternalJob {
    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    let resolveNativeDone!: () => void;
    const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
    const nativeDone = new Promise<void>((res) => { resolveNativeDone = res; });
    return {
      id: this.#uniqueId(), owner, kind, state: "queued", createdAt: this.#now(),
      startedAt: null, endedAt: null, nativeSettled: false,
      controller: new AbortController(), publishable: true, terminalPublished: false,
      runner: runner as JobRunner<unknown>, resolve, reject, promise, options,
      nativeDone, resolveNativeDone,
    };
  }

  #start(job: InternalJob): void {
    this.#active = job;
    job.state = "running";
    job.startedAt = this.#now();
    this.#armDeadline(job);
    const context: JobContext = {
      signal: job.controller.signal,
      publish: (effect) => {
        if (!job.publishable || this.#isTerminal(job)) return false;
        effect();
        return true;
      },
      isPublishable: () => job.publishable && !this.#isTerminal(job),
    };
    void Promise.resolve()
      .then(() => job.runner(context))
      .then(
        (value) => this.#nativeSettled(job, undefined, value),
        (error) => this.#nativeSettled(job, error),
      );
  }

  #armDeadline(job: InternalJob): void {
    const deadlineMs = job.options.deadlineMs;
    if (deadlineMs === undefined) return;
    job.deadlineTimer = this.#schedule(() => {
      const label = job.options.label ?? String(job.kind);
      const error = new JobTimedOutError(label, deadlineMs);
      job.controller.abort(error);
      this.#finishPublic(job, "timed_out", error);
      this.#armNativeStallWatchdog(job);
    }, deadlineMs);
  }

  #nativeSettled(job: InternalJob, error?: unknown, value?: unknown): void {
    if (job.deadlineTimer !== undefined) this.#clearScheduled(job.deadlineTimer);
    if (job.nativeStallTimer !== undefined) this.#clearScheduled(job.nativeStallTimer);
    job.nativeSettled = true;
    job.resolveNativeDone();
    if (!this.#isTerminal(job)) {
      if (error === undefined) this.#finishPublic(job, "completed", undefined, value);
      else this.#finishPublic(job, "failed", error);
    }
    if (this.#active === job) this.#active = null;
    this.#recoveryRequired = false;
    this.#pump();
    this.#pruneRetained();
  }

  #armNativeStallWatchdog(job: InternalJob): void {
    job.nativeStallTimer = this.#schedule(() => {
      if (job.nativeSettled || this.#active !== job) return;
      this.#recoveryRequired = true;
      const error = new QueueRecoveryRequiredError();
      for (const pending of [...this.#pending]) {
        this.#removePending(pending);
        pending.controller.abort(error);
        this.#finishPublic(pending, "failed", error);
        this.#settleNeverStarted(pending);
      }
    }, this.#nativeCancelGraceMs);
  }

  #finishPublic(job: InternalJob, state: JobState, error?: unknown, value?: unknown): void {
    if (job.terminalPublished) return;
    job.terminalPublished = true;
    job.publishable = false;
    job.state = state;
    job.endedAt = this.#now();
    if (error === undefined) job.resolve(value);
    else job.reject(error);
    try {
      this.#onTerminal?.(this.#publicStatus(job));
    } catch {
      // Observer failures cannot alter queue ownership or caller settlement.
    }
  }

  #disconnect(jobId: string, owner: string): boolean {
    const job = this.#ownedJob(jobId, owner);
    if (!job || this.#isTerminal(job)) return false;
    this.#removePending(job);
    const error = new JobDisconnectedError();
    job.controller.abort(error);
    this.#finishPublic(job, "disconnected", error);
    if (job !== this.#active) this.#settleNeverStarted(job);
    return true;
  }

  #settleNeverStarted(job: InternalJob): void {
    job.nativeSettled = true;
    job.resolveNativeDone();
    this.#pruneRetained();
  }

  #removePending(job: InternalJob): void {
    const index = this.#pending.indexOf(job);
    if (index >= 0) this.#pending.splice(index, 1);
  }

  #pump(): void {
    if (this.#active || !this.#accepting) return;
    const next = this.#pending.shift();
    if (next) this.#start(next);
  }

  #ownedJob(jobId: string, owner: string): InternalJob | null {
    const job = this.#jobs.get(jobId);
    return job?.owner === owner ? job : null;
  }

  #uniqueId(): string {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.#idFactory();
      if (id && !this.#jobs.has(id)) return id;
    }
    throw new Error("Unable to allocate a unique inference job ID.");
  }

  #pruneRetained(): void {
    const retained = [...this.#jobs.entries()].filter(([, job]) => job.nativeSettled && this.#isTerminal(job));
    const removeCount = Math.max(0, retained.length - this.#maxRetained);
    for (const [id] of retained.slice(0, removeCount)) this.#jobs.delete(id);
  }

  #isTerminal(job: InternalJob): boolean {
    return job.terminalPublished;
  }

  #position(job: InternalJob): number | null {
    if (this.#active === job) return 0;
    const index = this.#pending.indexOf(job);
    return index >= 0 ? index + 1 : null;
  }

  #publicStatus(job: InternalJob): PublicJobStatus {
    return {
      id: job.id,
      kind: job.kind,
      state: job.state,
      position: this.#position(job),
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
      nativeSettled: job.nativeSettled,
    };
  }

  async #waitForNative(job: InternalJob, graceMs: number): Promise<boolean> {
    if (job.nativeSettled) return true;
    if (graceMs <= 0) return false;
    let timer: unknown;
    const expired = new Promise<false>((resolve) => {
      timer = this.#schedule(() => resolve(false), graceMs);
    });
    const drained = job.nativeDone.then(() => true);
    return Promise.race([drained, expired]).finally(() => this.#clearScheduled(timer));
  }
}
