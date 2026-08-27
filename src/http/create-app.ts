import express, { type NextFunction, type Request, type Response } from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { parseClinicalRequest, canonicalClinicalRecord, findNarrativeConflicts } from "../triage/clinical-record.js";
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
import { lookupProtocol } from "../triage/protocol-table.js";
import { EMERGENCY_OBSERVATION_KEYS, normalizeDangerObservations } from "../triage/danger-observations.js";
import {
  RespiratoryAssessmentRequestSchema,
  StructuredDangerRequestSchema,
  ConfirmedReferenceResponseSchema,
  type Severity,
} from "../triage/schema.js";
import { browserSessionOwner } from "./session.js";
import { openSse, type SseStream } from "./sse.js";

const ConfirmationRequest = z.object({
  token: z.string().min(1).max(500),
  decision: z.enum(["CONFIRM", "REJECT"]),
}).strict();
const ContinuationRequest = z.object({ token: z.string().min(1).max(500) }).strict();

const JobId = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

type Dependencies = {
  supervisedWorkflow: {
    assess(input: unknown, options: {
      owner: string;
      signal?: AbortSignal;
      onStage?: (stage: unknown) => void;
      onCitation?: (citation: unknown) => void;
      onFirstToken?: () => void;
    }): Promise<any>;
    deterministic?(input: unknown, options?: { owner?: string }): any | null;
    claimContinuation?(token: string, owner: string): any;
    commitContinuation?(token: string, owner: string): boolean;
    releaseContinuation?(token: string, owner: string): boolean;
    continueClaim?(claim: any, options: {
      owner: string;
      signal?: AbortSignal;
      onStage?: (stage: unknown) => void;
      onCitation?: (citation: unknown) => void;
      onFirstToken?: () => void;
    }): Promise<any>;
  };
  promptRunner: { run(input: unknown, options: { modelId: string; signal?: AbortSignal }): Promise<any> };
  confirmationStore: {
    inspect?(token: string, owner: string): any;
    consume(token: string, owner: string, decision: "CONFIRM" | "REJECT"): any;
  };
  projectReferenceActions: (classification: string, severity: Severity, eligibility: any) => any;
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

const PUBLIC_CARD_FIELDS = [
  "outcome", "finding", "basis", "nextAssessmentStep", "matchedCriteria", "missingFields",
  "recorded", "thresholdComparison", "emergencyObservations", "sourceRule", "assistance", "uncertainty",
  "reviewState", "recordedFacts", "inferredFacts",
] as const;

function publicCard(result: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(PUBLIC_CARD_FIELDS.filter((key) => result[key] !== undefined).map((key) => [key, result[key]]));
}

function sendAssessment(stream: SseStream, result: any, deps: Dependencies): void {
  for (const citation of result.citations ?? []) {
    stream.send("citation", {
      protocol: result.protocol,
      ...citation,
      score: 1,
      retrieval: result.assistance?.retrievalMode ?? "keyword",
      provenance: "fixed-protocol",
    });
  }
  stream.send("card", { card: publicCard(result), attempts: result.attempts ?? 0, perf: deps.performance?.() ?? null });
  if (result.reviewState === "PROVISIONAL" && result.confirmation?.token) {
    stream.send("provisional", {
      token: result.confirmation.token,
      expiresAt: result.confirmation.expiresAt,
      classification: result.classification,
      protocol: result.protocol,
    });
  }
}

function sendDeterministic(stream: SseStream, result: any): void {
  const card = { ...publicCard(result), assistance: { status: "NOT_RUN", runtime: null, model: null } };
  stream.send("stage", { key: "assess", label: "Applied deterministic recorded-observation policy" });
  if (result.outcome === "ASSESSMENT_REQUIRED") stream.send("assessment_required", { card });
  else {
    stream.send("citation", { ...result.sourceRule, protocol: "IMCI", retrieval: "deterministic", provenance: "fixed-policy", score: 1 });
    stream.send("card", { card, attempts: 0 });
  }
  if (result.continuation?.eligible && result.continuation.token) {
    stream.send("continuation", result.continuation);
  }
  stream.send("done", { ok: true });
  stream.finish();
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

function triageRoute(deps: Dependencies) {
  return async (request: Request, response: Response): Promise<void> => {
    const validationError = clinicalValidationError(request.body);
    if (validationError) { response.status(400).json({ error: validationError }); return; }
    const parsed = parseClinicalRequest(request.body);
    if (!parsed.success) { response.status(400).json({ error: "Invalid clinical assessment." }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    const observations = normalizeDangerObservations(parsed.data.dangerObservations);
    const hasEmergency = EMERGENCY_OBSERVATION_KEYS.some((key) => observations[key] === "PRESENT");
    const emergency = hasEmergency ? deps.supervisedWorkflow.deterministic?.(parsed.data, { owner }) : null;
    if (emergency?.outcome === "EMERGENCY") {
      response.setHeader("Cache-Control", "no-store");
      sendDeterministic(openSse(response, () => undefined), emergency);
      return;
    }
    const conflicts = findNarrativeConflicts(canonicalClinicalRecord(parsed.data));
    if (conflicts.length) {
      response.status(409).json({
        error: "The description conflicts with the structured assessment. Correct the patient record before continuing.",
        conflicts: conflicts.map((field) => field.replace(/^dangerObservations\./, "")),
      });
      return;
    }
    const deterministic = deps.supervisedWorkflow.deterministic?.(parsed.data, { owner });
    if (deterministic) {
      response.setHeader("Cache-Control", "no-store");
      const stream = openSse(response, () => undefined);
      sendDeterministic(stream, deterministic);
      return;
    }
    const pendingEffects: Array<(target: SseStream) => void> = [];
    let stream: SseStream | null = null;
    const publish = (effect: (target: SseStream) => void) => {
      if (stream) effect(stream); else pendingEffects.push(effect);
    };
    const reasonStartedAt = Date.now();
    let submitted;
    try {
      submitted = deps.inferenceQueue.submit(owner, "triage", (context) => deps.supervisedWorkflow.assess(parsed.data, {
        owner,
        signal: context.signal,
        onStage: (stage: unknown) => context.publish(() => publish((target) => target.send("stage", stage))),
        onCitation: (citation: unknown) => context.publish(() => publish((target) => target.send("citation", citation))),
        onFirstToken: () => context.publish(() => publish((target) => target.send("first_token", { ttftMs: Date.now() - reasonStartedAt }))),
      }), { deadlineMs: deps.triageDeadlineMs ?? 300_000, label: "Clinical assessment" });
    } catch (error) {
      if (!queueFailure(response, error)) response.status(503).json({
        error: "Local assessment could not be admitted.", code: "INFERENCE_FAILED", retryable: false,
      });
      return;
    }
    const job = submitted;
    stream = openSse(response, () => job.disconnect());
    stream.send("job", { id: job.id, position: job.position });
    stream.send("stage", { key: job.position ? "queued" : "assess", label: job.position ? "Queued for local inference" : "Reviewing recorded assessment" });
    pendingEffects.splice(0).forEach((effect) => effect(stream!));
    try {
      const result = await job.promise;
      if (stream.isOpen()) sendAssessment(stream, result, deps);
      stream.send("done", { ok: true });
      stream.finish();
    } catch (error) { if (stream.isOpen()) safeError(stream, error); }
  };
}

function continuationFailure(response: Response, reason: string): void {
  const statuses: Record<string, number> = {
    NOT_FOUND: 404, EXPIRED: 410, USED: 409, OWNER_MISMATCH: 403, BINDING_MISMATCH: 409,
  };
  response.status(statuses[reason] ?? 409).json({
    error: "Respiratory continuation could not be started.", reason,
  });
}

function continuationRoute(deps: Dependencies) {
  return async (request: Request, response: Response): Promise<void> => {
    const parsed = ContinuationRequest.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: "Invalid continuation request." }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    const claim = deps.supervisedWorkflow.claimContinuation?.(parsed.data.token, owner);
    if (!claim?.ok) { continuationFailure(response, String(claim?.reason ?? "NOT_FOUND")); return; }
    if (!deps.supervisedWorkflow.continueClaim) {
      deps.supervisedWorkflow.releaseContinuation?.(parsed.data.token, owner);
      continuationFailure(response, "NOT_FOUND"); return;
    }

    const pendingEffects: Array<(target: SseStream) => void> = [];
    let stream: SseStream | null = null;
    const publish = (effect: (target: SseStream) => void) => {
      if (stream) effect(stream); else pendingEffects.push(effect);
    };
    const reasonStartedAt = Date.now();
    let submitted;
    try {
      submitted = deps.inferenceQueue.submit(owner, "triage", (context) => deps.supervisedWorkflow.continueClaim!(claim, {
        owner,
        signal: context.signal,
        onStage: (stage: unknown) => context.publish(() => publish((target) => target.send("stage", stage))),
        onCitation: (citation: unknown) => context.publish(() => publish((target) => target.send("citation", citation))),
        onFirstToken: () => context.publish(() => publish((target) => target.send("first_token", { ttftMs: Date.now() - reasonStartedAt }))),
      }), { deadlineMs: deps.triageDeadlineMs ?? 300_000, label: "Supervised respiratory continuation" });
    } catch (error) {
      if (error instanceof QueueSaturatedError) deps.supervisedWorkflow.releaseContinuation?.(parsed.data.token, owner);
      else deps.supervisedWorkflow.commitContinuation?.(parsed.data.token, owner);
      if (!queueFailure(response, error)) response.status(503).json({
        error: "Local continuation could not be admitted.", code: "INFERENCE_FAILED", retryable: false,
      });
      return;
    }
    deps.supervisedWorkflow.commitContinuation?.(parsed.data.token, owner);
    const job = submitted;
    response.setHeader("Cache-Control", "no-store");
    stream = openSse(response, () => job.disconnect());
    stream.send("job", { id: job.id, position: job.position });
    stream.send("stage", {
      key: job.position ? "queued" : "assess",
      label: job.position ? "Queued for local inference" : "Continuing supervised WHO review",
    });
    pendingEffects.splice(0).forEach((effect) => effect(stream!));
    try {
      const result = await job.promise;
      if (stream.isOpen()) sendAssessment(stream, result, deps);
      stream.send("done", { ok: true });
      stream.finish();
    } catch (error) { if (stream.isOpen()) safeError(stream, error); }
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

function confirmationRoute(deps: Dependencies) {
  return (request: Request, response: Response): void => {
    const parsed = ConfirmationRequest.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: "Invalid confirmation request." }); return; }
    const owner = (deps.sessionOwner ?? browserSessionOwner)(request, response);
    response.setHeader("Cache-Control", "no-store");
    const inspected = parsed.data.decision === "CONFIRM" && deps.confirmationStore.inspect
      ? deps.confirmationStore.inspect(parsed.data.token, owner)
      : deps.confirmationStore.consume(parsed.data.token, owner, parsed.data.decision);
    if (!inspected.ok) {
      const statuses: Record<string, number> = {
        NOT_FOUND: 404, EXPIRED: 410, USED: 409, OWNER_MISMATCH: 403, BINDING_MISMATCH: 409,
      };
      const status = statuses[String(inspected.reason)] ?? 409;
      response.status(status).json({ error: "Confirmation could not be applied.", reason: inspected.reason });
      return;
    }
    if (parsed.data.decision === "REJECT") { response.json({ reviewState: "REJECTED" }); return; }
    const entry = lookupProtocol(inspected.binding.classification);
    const eligibility = inspected.payload?.eligibility ?? { confirmationState: "CONFIRMED" };
    const projected = deps.projectReferenceActions(inspected.binding.classification, entry?.severity ?? "UNKNOWN", { ...eligibility, confirmationState: "CONFIRMED" });
    const severity = inspected.binding.fixedSeverity ?? entry?.severity ?? "UNKNOWN";
    const immediateAction = projected.referenceActions?.immediateAction;
    const candidate = {
      reviewState: "CONFIRMED" as const,
      classification: inspected.binding.classification,
      protocol: inspected.binding.protocol,
      severity,
      ...(immediateAction ? { immediateAction } : {}),
      ...projected,
    };
    const publicResult = ConfirmedReferenceResponseSchema.safeParse(candidate);
    if (!publicResult.success) { response.status(500).json({ error: "Confirmed source actions failed public validation." }); return; }
    if (deps.confirmationStore.inspect) {
      const consumed = deps.confirmationStore.consume(parsed.data.token, owner, "CONFIRM");
      if (!consumed.ok) {
        const status = consumed.reason === "OWNER_MISMATCH" ? 403 : consumed.reason === "EXPIRED" ? 410 : 409;
        response.status(status).json({ error: "Confirmation could not be applied.", reason: consumed.reason });
        return;
      }
    }
    response.json(publicResult.data);
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
  app.post("/triage", triageRoute(deps));
  app.all("/triage", methodNotAllowed("POST"));
  app.post("/triage/continue", continuationRoute(deps));
  app.all("/triage/continue", methodNotAllowed("POST"));
  app.post("/triage/confirm", confirmationRoute(deps));
  app.all("/triage/confirm", methodNotAllowed("POST"));
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
