import type { ChildProcess } from "node:child_process";

type TraceBase = { phase: string; requestSha256: string; caseId?: string };

type CaptureArgs<T> = {
  traces: unknown[];
  base: TraceBase;
  operation: () => Promise<T>;
  success: (result: T, durationMs: number) => Record<string, unknown>;
  now?: () => number;
};

export function officialGreedySampling(): { temperature: 0; samplers: ["temperature"] } {
  return { temperature: 0, samplers: ["temperature"] };
}

export function officialServerCommand(binary: string, model: string, port: number): string[] {
  return [
    binary, "-m", model, "-t", "4", "-ngl", "0", "-c", "2048",
    "--host", "127.0.0.1", "--port", String(port), "--jinja",
    "--reasoning-format", "none", "--reasoning-budget", "0", "--no-webui",
  ];
}

export async function stopOfficialServer(child: ChildProcess, timeoutMs = 15_000): Promise<boolean> {
  if (child.exitCode !== null) return true;
  const closed = new Promise<void>((resolveClose) => child.once("close", () => resolveClose()));
  child.kill("SIGTERM");
  const graceful = await Promise.race([
    closed.then(() => true),
    new Promise<boolean>((resolveTimeout) => setTimeout(() => resolveTimeout(false), timeoutMs)),
  ]);
  if (graceful) return true;
  child.kill("SIGKILL");
  if (child.exitCode === null) await closed;
  return false;
}

export async function captureOfficialAttempt<T>(args: CaptureArgs<T>): Promise<T> {
  const now = args.now ?? performance.now.bind(performance);
  const started = now();
  try {
    const result = await args.operation();
    args.traces.push({ ...args.base, ...args.success(result, Math.round(now() - started)) });
    return result;
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    args.traces.push({
      ...args.base,
      responseSha256: null,
      rawOutput: null,
      durationMs: Math.round(now() - started),
      generatedTokens: null,
      tokensPerSecond: null,
      error: { name, timedOut: /timeout/i.test(name) },
    });
    throw error;
  }
}

export function selectOfficialCases<T extends { promptId: string }>(
  cases: T[],
  options: { promptId?: string; limit?: number },
): T[] {
  const matching = options.promptId ? cases.filter((item) => item.promptId === options.promptId) : cases;
  return matching.slice(0, options.limit ?? matching.length);
}
