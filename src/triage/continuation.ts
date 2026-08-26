import { randomUUID } from "node:crypto";

export interface ContinuationBinding {
  recordHash: string;
  outcome: "PROMPT_SUPERVISED_REVIEW" | "NO_ESCALATION_CRITERION_RECORDED";
  matchedCriteria: string[];
  policyVersion: string;
  owner: string;
}

export type ContinuationGrant = { token: string; expiresAt: string };
export type ContinuationConsumeResult =
  | { ok: true; binding: ContinuationBinding; snapshot: unknown }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "OWNER_MISMATCH" };

type StoredContinuation = {
  binding: ContinuationBinding;
  snapshot: unknown;
  expiresAtMs: number;
  state: "AVAILABLE" | "RESERVED" | "USED";
};

type ContinuationStoreOptions = {
  now?: () => number;
  randomToken?: () => string;
  ttlMs?: number;
  capacity?: number;
};

function copyBinding(binding: ContinuationBinding): ContinuationBinding {
  return { ...binding, matchedCriteria: [...binding.matchedCriteria] };
}

export class ContinuationStore {
  private readonly records = new Map<string, StoredContinuation>();
  private readonly now: () => number;
  private readonly randomToken: () => string;
  private readonly ttlMs: number;
  private readonly capacity: number;

  constructor(options: ContinuationStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomToken = options.randomToken ?? randomUUID;
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.capacity = options.capacity ?? 100;
    if (this.ttlMs <= 0 || this.capacity <= 0) throw new RangeError("Continuation store limits must be positive.");
  }

  get size(): number { return this.activeCount(); }

  issue(binding: ContinuationBinding, snapshot: unknown): ContinuationGrant {
    const now = this.now();
    this.pruneExpired(now);
    if (this.activeCount() >= this.capacity) throw new Error("Continuation store capacity reached.");
    const token = this.uniqueToken();
    const expiresAtMs = now + this.ttlMs;
    this.records.set(token, {
      binding: copyBinding(binding), snapshot: structuredClone(snapshot), expiresAtMs, state: "AVAILABLE",
    });
    return { token, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  consume(token: string, owner: string): ContinuationConsumeResult {
    const reserved = this.reserve(token, owner);
    if (!reserved.ok) return reserved;
    this.commit(token, owner);
    return reserved;
  }

  reserve(token: string, owner: string): ContinuationConsumeResult {
    const record = this.records.get(token);
    if (!record) return { ok: false, reason: "NOT_FOUND" };
    if (this.now() >= record.expiresAtMs) {
      this.records.delete(token);
      return { ok: false, reason: "EXPIRED" };
    }
    if (record.binding.owner !== owner) return { ok: false, reason: "OWNER_MISMATCH" };
    if (record.state !== "AVAILABLE") return { ok: false, reason: "USED" };
    record.state = "RESERVED";
    return {
      ok: true,
      binding: copyBinding(record.binding),
      snapshot: structuredClone(record.snapshot),
    };
  }

  commit(token: string, owner: string): boolean {
    const record = this.records.get(token);
    if (!record || record.binding.owner !== owner || record.state !== "RESERVED") return false;
    record.state = "USED";
    return true;
  }

  release(token: string, owner: string): boolean {
    const record = this.records.get(token);
    if (!record || record.binding.owner !== owner || record.state !== "RESERVED") return false;
    record.state = "AVAILABLE";
    return true;
  }

  clear(): void { this.records.clear(); }

  private pruneExpired(now: number): void {
    for (const [token, record] of this.records) if (now >= record.expiresAtMs) this.records.delete(token);
  }

  private activeCount(): number {
    let count = 0;
    for (const record of this.records.values()) if (record.state !== "USED") count += 1;
    return count;
  }

  private uniqueToken(): string {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = this.randomToken();
      if (token && !this.records.has(token)) return token;
    }
    throw new Error("Unable to issue a unique continuation token.");
  }
}
