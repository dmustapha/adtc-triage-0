const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "AbortError",
  "JobCancelledError",
  "JobDisconnectedError",
  "JobTimedOutError",
  "QueueClosedError",
  "QueueRecoveryRequiredError",
  "QueueSaturatedError",
]);

export function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return SAFE_ERROR_NAMES.has(error.name) ? error.name : "Error";
}

type Diagnostic = { count: number; error: string };
const diagnostics = new Map<string, Diagnostic>();

export function recordDiagnostic(code: string, error: unknown): void {
  const safeCode = /^[A-Z][A-Z0-9_]{1,47}$/.test(code) ? code : "UNKNOWN_DIAGNOSTIC";
  const previous = diagnostics.get(safeCode);
  const next = { count: (previous?.count ?? 0) + 1, error: safeErrorName(error) };
  if (!previous && diagnostics.size >= 32) return;
  diagnostics.set(safeCode, next);
  if (!previous) process.stderr.write(`[triage-0] diagnostic ${safeCode} (${next.error})\n`);
}

export function runtimeDiagnostics(): Record<string, Diagnostic> {
  return Object.fromEntries([...diagnostics].map(([code, value]) => [code, { ...value }]));
}
