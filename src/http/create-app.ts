import express, { type NextFunction, type Request, type Response } from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { PromptRequestSchema } from "../prompt/schema.js";
import {
  JobCancelledError,
  JobDisconnectedError,
  JobTimedOutError,
  QueueClosedError,
  QueueRecoveryRequiredError,
  QueueSaturatedError,
  type InferenceQueue,
} from "../qvac/inference-queue.js";
import {
  RespiratoryAssessmentRequestSchema,
  StructuredDangerRequestSchema,
} from "../triage/schema.js";
import { browserSessionOwner } from "./session.js";
import { openSse, type SseStream } from "./sse.js";

const JobId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

type Dependencies = {
  supervisedWorkflow: {
    guide(input: unknown, options: {
      owner: string;
      signal?: AbortSignal;
      onStage?: (s: unknown) => void;
      onCitation?: (c: unknown) => void;
      onFirstToken?: () => void;
    }): Promise<{ card: any; classification: string; retrieval: string }>;
  };
  promptRunner: { run(input: unknown, options: { modelId: string; signal?: AbortSignal }): Promise<any> };
  inferenceQueue: InferenceQueue;
  sessionOwner?: (request: Request, response: Response) => string;
  promptModelId?: string;
  performance?: () => unknown;
  triageDeadlineMs?: number;
  assistDeadlineMs?: number;
};

function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
}

function queueFailure(response: Response, error: unknown): boolean {
  if (error instanceof QueueRecoveryRequiredError) {
    response.status(503).json({
      error: "Local inference requires an app restart before retrying.",
      code: "RESTART_REQUIRED",
      retryable: false,
    });
    return true;
  }
  if (error instanceof QueueClosedError) {
    response.status(503).json({
      error: "Local inference is shutting down. Restart the supported app before retrying.",
      code: "QUEUE_CLOSED",
      retryable: false,
    });
    return true;
  }
  if (error instanceof QueueSaturatedError) {
    response.setHeader("Retry-After", "2");
    response.status(429).json({
      error: "Local inference is busy. Please retry shortly.",
      code: "QUEUE_BUSY",
      retryable: true,
      retryAfterSeconds: 2,
    });
    return true;
  }
  return false;
}

function safeError(stream: SseStream, error: unknown): void {
  const failure = error instanceof QueueRecoveryRequiredError
    ? { code: "RESTART_REQUIRED", reason: "Native inference did not stop safely. Restart the local app before retrying.", retryable: false }
    : error instanceof JobTimedOutError
      ? { code: "TIMEOUT", reason: "Local inference took too long. Retry once; restart the app if it remains unavailable.", retryable: true }
      : error instanceof JobCancelledError
        ? { code: "CANCELLED", reason: "The local inference job was cancelled. Start a new run when ready.", retryable: true }
        : error instanceof JobDisconnectedError
          ? { code: "DISCONNECTED", reason: "The request disconnected and local inference was stopped.", retryable: true }
          : { code: "INFERENCE_FAILED", reason: "Local inference failed safely. Check readiness or restart the supported app before a new run.", retryable: false };
  stream.send("error", failure);
  stream.send("done", { ok: false });
  stream.finish();
}

function clinicalValidationError(body: any): string | null {
  const caseText = typeof body?.caseText === "string" ? body.caseText : "";
  if (!caseText.trim()) return "caseText is required.";
  if (caseText.length > 2000) return "Case description is too long. Please shorten it to the key signs and symptoms.";
  if (body?.respiratoryAssessment !== undefined
    && !RespiratoryAssessmentRequestSchema.safeParse(body.respiratoryAssessment).success) {
    return "Invalid structured respiratory assessment.";
  }
  const structured = StructuredDangerRequestSchema.safeParse({
    patientAge: body?.patientAge,
    dangerObservations: body?.dangerObservations,
    respiratoryAssessment: body?.respiratoryAssessment,
  });
  return structured.success ? null : "Invalid structured danger assessment.";
}

type DeferredStream = {
  effects: Array<(target: SseStream) => void>;
  publish: (effect: (target: SseStream) => void) => void;
  attach: (stream: SseStream) => void;
};

function deferredStream(): DeferredStream {
  let target: SseStream | null = null;
  const effects: Array<(stream: SseStream) => void> = [];
  return {
    effects,
    publish: (effect) => { if (target) effect(target); else effects.push(effect); },
    attach: (stream) => { target = stream; effects.splice(0).forEach((effect) => effect(stream)); },
  };
}

function assistRoute(deps: Dependencies) {
  return async (request: Request, response: Response): Promise<void> => {
    const parsed = PromptRequestSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: "Invalid prompt." }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    let submitted;
    try {
      submitted = deps.inferenceQueue.submit(owner, "assist", (context) =>
        deps.promptRunner.run(parsed.data, { modelId: deps.promptModelId ?? "local-medpsy", signal: context.signal }),
      { deadlineMs: deps.assistDeadlineMs ?? 180_000, label: "Prompt assistance" });
    } catch (error) {
      if (!queueFailure(response, error)) response.status(503).json({
        error: "Local assistance could not be admitted.", code: "INFERENCE_FAILED", retryable: false,
      });
      return;
    }
    const job = submitted;
    const stream = openSse(response, () => job.disconnect());
    stream.send("job", { id: job.id, position: job.position });
    stream.send("stage", { key: job.position ? "queued" : "reason", label: job.position ? "Queued for local inference" : "Reasoning on-device" });
    try {
      const result = await job.promise;
      const publicResult = result.status === "CANCELLED"
        ? { ...result, code: "CANCELLED", retryable: true }
        : result.status === "UNAVAILABLE"
          ? { ...result, code: "RUNTIME_UNAVAILABLE", retryable: true }
          : result;
      if (stream.isOpen()) stream.send(result.status === "COMPLETED" ? "answer" : "rejected", publicResult);
      stream.send("done", { ok: result.status === "COMPLETED" });
      stream.finish();
    } catch (error) { if (stream.isOpen()) safeError(stream, error); }
  };
}

function sendGuide(stream: SseStream, result: { card: any; classification: string }, deps: Dependencies): void {
  const { plan, ...cardNoPlan } = result.card ?? {};
  stream.send("card", {
    card: { ...cardNoPlan, translated: false, source_language: "en" },
    classification: result.classification,
    perf: deps.performance?.() ?? null,
  });
  if (result.card?.severity && result.card.severity !== "UNKNOWN" && plan) {
    stream.send("plan", { plan });
  }
}

function guideRoute(deps: Dependencies) {
  return async (request: Request, response: Response): Promise<void> => {
    const validationError = clinicalValidationError(request.body);
    if (validationError) { response.status(400).json({ error: validationError }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    const deferred = deferredStream();
    const startedAt = Date.now();
    let job;
    try {
      job = deps.inferenceQueue.submit(owner, "triage", (context) => deps.supervisedWorkflow.guide(request.body, {
        owner,
        signal: context.signal,
        onStage: (s) => context.publish(() => deferred.publish((st) => st.send("stage", s))),
        onCitation: (c) => context.publish(() => deferred.publish((st) => st.send("citation", c))),
        onFirstToken: () => context.publish(() => deferred.publish((st) => st.send("first_token", { ttftMs: Date.now() - startedAt }))),
      }), { deadlineMs: deps.triageDeadlineMs ?? 300_000, label: "Clinical guidance" });
    } catch (error) {
      if (!queueFailure(response, error)) response.status(503).json({ error: "Local guidance could not be admitted.", code: "INFERENCE_FAILED", retryable: false });
      return;
    }
    const stream = openSse(response, () => job.disconnect());
    stream.send("job", { id: job.id, position: job.position });
    stream.send("stage", { key: job.position ? "queued" : "assess", label: job.position ? "Queued for local inference" : "Reviewing the case" });
    deferred.attach(stream);
    try {
      const result = await job.promise;
      if (stream.isOpen()) sendGuide(stream, result, deps);
      stream.send("done", { ok: true });
      stream.finish();
    } catch (error) { if (stream.isOpen()) safeError(stream, error); }
  };
}

function methodNotAllowed(allow: string) {
  return (_request: Request, response: Response): void => {
    response.setHeader("Allow", allow);
    response.status(405).json({ error: "Method Not Allowed" });
  };
}

export function createRestoredApp(deps: Dependencies) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(securityHeaders);
  app.use(express.static(resolve(process.cwd(), "public"), { setHeaders: (response) => response.setHeader("Cache-Control", "no-cache") }));
  app.get("/app", (_request, response) => response.sendFile(resolve(process.cwd(), "public", "app.html")));
  registerRestoredRoutes(app, deps);
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) { next(error); return; }
    const type = (error as { type?: string })?.type;
    if (type === "entity.too.large") { response.status(413).json({ error: "Request body is too large." }); return; }
    if (error instanceof SyntaxError) { response.status(400).json({ error: "Malformed JSON body." }); return; }
    response.status(500).json({ error: "Something went wrong on-device." });
  });
  return app;
}

export function registerRestoredRoutes(app: express.Express, deps: Dependencies): void {
  app.post("/triage", guideRoute(deps));
  app.all("/triage", methodNotAllowed("POST"));
  app.post("/assist", assistRoute(deps));
  app.all("/assist", methodNotAllowed("POST"));
  app.delete("/jobs/:id", (request, response) => {
    const parsedId = JobId.safeParse(request.params.id);
    if (!parsedId.success) { response.status(400).json({ error: "Invalid job identifier." }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    const status = deps.inferenceQueue.status(parsedId.data, owner);
    if (!status) { response.status(404).json({ error: "Job not found." }); return; }
    if (["completed", "failed", "cancelled", "timed_out", "disconnected"].includes(status.state)) {
      response.status(409).json({ error: "Job is already complete." }); return;
    }
    deps.inferenceQueue.cancel(parsedId.data, owner);
    response.json({ ok: true, state: "cancelled" });
  });
}
