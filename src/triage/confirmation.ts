import { randomUUID } from "node:crypto";

export interface ConfirmationBinding {
  recordHash: string;
  classification: string;
  protocol: "IMCI" | "mhGAP";
  citationKeys: string[];
  policyVersion: string;
  owner: string;
  fixedSeverity?: "EMERGENCY" | "URGENT" | "ROUTINE" | "SELF_CARE" | "UNKNOWN";
  sourceAction?: { text: string; doc: string; page: number };
}

export type ConfirmationDecision = "CONFIRM" | "REJECT";
export type ConfirmationGrant = { token: string; expiresAt: string };
export type ConfirmationPayload = Readonly<Record<string, unknown>>;
export type ConsumeResult =
  | { ok: true; decision: ConfirmationDecision; binding: ConfirmationBinding; payload?: ConfirmationPayload; replayed?: boolean }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "OWNER_MISMATCH" | "BINDING_MISMATCH" };
export type InspectResult =
  | { ok: true; binding: ConfirmationBinding; payload?: ConfirmationPayload }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "OWNER_MISMATCH" };

type StoredGrant = {
  binding: ConfirmationBinding;
  payload?: ConfirmationPayload;
  expiresAtMs: number;
  decision: ConfirmationDecision | null;
};

type ConfirmationStoreOptions = {
  now?: () => number;
  randomToken?: () => string;
  ttlMs?: number;
  capacity?: number;
};

function sameBinding(first: ConfirmationBinding, second: ConfirmationBinding): boolean {
  return first.recordHash === second.recordHash
    && first.classification === second.classification
    && first.protocol === second.protocol
    && first.policyVersion === second.policyVersion
    && first.owner === second.owner
    && first.citationKeys.length === second.citationKeys.length
    && first.citationKeys.every((key, index) => key === second.citationKeys[index])
    && first.fixedSeverity === second.fixedSeverity
    && JSON.stringify(first.sourceAction) === JSON.stringify(second.sourceAction);
}

function copyBinding(binding: ConfirmationBinding): ConfirmationBinding {
  return {
    ...binding,
    citationKeys: [...binding.citationKeys],
    ...(binding.sourceAction ? { sourceAction: { ...binding.sourceAction } } : {}),
  };
}

function copyPayload(payload: ConfirmationPayload): ConfirmationPayload {
  return structuredClone(payload);
}

export class ConfirmationStore {
  private readonly records = new Map<string, StoredGrant>();
  private readonly now: () => number;
  private readonly randomToken: () => string;
  private readonly ttlMs: number;
  private readonly capacity: number;

  constructor(options: ConfirmationStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomToken = options.randomToken ?? randomUUID;
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.capacity = options.capacity ?? 100;
    if (this.ttlMs <= 0 || this.capacity <= 0) throw new RangeError("Confirmation store limits must be positive.");
  }

  get size(): number {
    return this.activeCount();
  }

  issue(binding: ConfirmationBinding, payload?: ConfirmationPayload): ConfirmationGrant {
    const now = this.now();
    this.pruneExpired(now);
    if (this.activeCount() >= this.capacity) throw new Error("Confirmation store capacity reached.");
    const token = this.uniqueToken();
    const expiresAtMs = now + this.ttlMs;
    this.records.set(token, {
      binding: copyBinding(binding),
      ...(payload ? { payload: copyPayload(payload) } : {}),
      expiresAtMs,
      decision: null,
    });
    return { token, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  consume(token: string, owner: string, decision: ConfirmationDecision, expected?: ConfirmationBinding): ConsumeResult {
    const record = this.records.get(token);
    if (!record) return { ok: false, reason: "NOT_FOUND" };
    if (this.now() >= record.expiresAtMs) {
      this.records.delete(token);
      return { ok: false, reason: "EXPIRED" };
    }
    if (record.binding.owner !== owner) return { ok: false, reason: "OWNER_MISMATCH" };
    if (expected && !sameBinding(record.binding, expected)) return { ok: false, reason: "BINDING_MISMATCH" };
    if (record.decision) {
      return { ok: false, reason: "USED" };
    }
    record.decision = decision;
    return {
      ok: true,
      decision,
      binding: copyBinding(record.binding),
      ...(record.payload ? { payload: copyPayload(record.payload) } : {}),
    };
  }

  inspect(token: string, owner: string): InspectResult {
    const record = this.records.get(token);
    if (!record) return { ok: false, reason: "NOT_FOUND" };
    if (this.now() >= record.expiresAtMs) {
      this.records.delete(token);
      return { ok: false, reason: "EXPIRED" };
    }
    if (record.binding.owner !== owner) return { ok: false, reason: "OWNER_MISMATCH" };
    if (record.decision) return { ok: false, reason: "USED" };
    return {
      ok: true,
      binding: copyBinding(record.binding),
      ...(record.payload ? { payload: copyPayload(record.payload) } : {}),
    };
  }

  invalidate(token: string): void {
    this.records.delete(token);
  }

  clear(): void {
    this.records.clear();
  }

  private pruneExpired(now: number): void {
    for (const [token, record] of this.records) {
      if (now >= record.expiresAtMs) this.records.delete(token);
    }
  }

  private activeCount(): number {
    let count = 0;
    for (const record of this.records.values()) if (!record.decision) count += 1;
    return count;
  }

  private uniqueToken(): string {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = this.randomToken();
      if (token && !this.records.has(token)) return token;
    }
    throw new Error("Unable to issue a unique confirmation token.");
  }
}
