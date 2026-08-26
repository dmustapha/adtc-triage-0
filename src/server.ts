// File: src/server.ts
// Triage-0 local server. Hosts @qvac/sdk and serves the localhost web UI. Every clinical call runs
// on-device through the orchestrator (model lifecycle) + engine (timed, perf-logged). This process is
// the SOLE opener of the RAG store (single-writer RocksDB) — do not run it alongside `npm run ingest`.
//
// Routes:
//   GET  /health        — liveness + resident models + chunk count + resident mode
//   POST /triage        — SSE: citation (early) -> first-token telemetry -> card+perf
//   GET  /perf-log      — { rows }   |   GET /perf-log.csv — raw CSV
import express, { type Request, type Response, type NextFunction } from "express";
import { resolve } from "node:path";
import { config } from "./config.js";
import { orchestrator } from "./qvac/orchestrator.js";
import {
  runTriage,
  retrieveGrounding,
  triageFromHits,
  type TriageContext,
} from "./triage/triage.js";
import { routeCase, ensureClassPrototypes } from "./triage/class-router.js";
import { readPerfCsv, readPerfRows } from "./qvac/perf-logger.js";
import { chunkCount, citationMapHealthy } from "./rag/store.js";
import { guard } from "./qvac/egress-guard.js";
import { InferenceQueue } from "./qvac/inference-queue.js";
import { loadModelContract, readModelIdentity } from "./model-contract.js";
import { createRestoredApp, registerRestoredRoutes } from "./http/create-app.js";
import { createSupervisedWorkflow } from "./triage/supervised-workflow.js";
import { ConfirmationStore } from "./triage/confirmation.js";
import { ContinuationStore } from "./triage/continuation.js";
import { projectReferenceActions } from "./triage/reference-actions.js";
import { createPromptRunner } from "./prompt/runner.js";
import { runtimeDiagnostics, safeErrorName } from "./logging.js";
export { createRestoredApp as createApp };

const modelIdentity = readModelIdentity();

// The @qvac inference engine is SINGLE-JOB per process — submitting a second inference while one is
// running throws "Cannot set new job". On one device with one model that is the honest physical limit:
// it does one inference at a time. So serialize every inference endpoint through one queue. Concurrent
// requests (e.g. a judge opening two tabs) wait their turn instead of colliding with a raw error.
export const sharedInferenceQueue = new InferenceQueue({ maxPending: 4 });
/** Native RAG store liveness, set at prewarm by a canonical query. `chunkCount()` reads the citation
 *  SIDECAR (can report healthy while the native vector store is empty/wiped — the exact failure that made
 *  every case abstain), so this is the real "does ragSearch return hits" signal, surfaced on /health. */
let ragLive: boolean | null = null;
let modelContractVerified = false;
const TRIAGE_TIMEOUT_MS = 300_000; // 5 min — 4B model on CPU needs headroom

/** Log the real error server-side (stderr only) and return a fixed, friendly message — never leak an
 *  absolute model/file path or a raw SDK string to the client (it would show in a judge's screen capture). */
function clientError(res: Response, err: unknown, message: string, code = 500): void {
  process.stderr.write(`[triage-0] ${message} :: ${safeErrorName(err)}\n`);
  if (!res.headersSent) res.status(code).json({ error: message });
}

export const app = express();
app.use(express.json({ limit: "256kb" }));

// Content-Security-Policy: must precede express.static so headers apply to all responses.
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// `no-cache` = the browser may store the asset but MUST revalidate before using it (cheap: ETag → 304 when
// unchanged). Without this a browser can serve a stale triage.js after an update — which looked like the
// spoken guidance "only read one line" (old code) even though the current code reads the whole management.
app.use(express.static(resolve(process.cwd(), "public"), {
  setHeaders: (res) => { res.setHeader("Cache-Control", "no-cache"); },
}));

// Clean URL for the tool. The landing is "/" (public/index.html, served by static above); the tool
// lives at public/app.html and is reachable at "/app.html" via static, but the landing CTA links to
// "/app", so alias it. (A future "/proof" page would get the same treatment once it exists.)
app.get("/app", (_req: Request, res: Response) => {
  res.sendFile(resolve(process.cwd(), "public", "app.html"));
});
app.all("/app", methodNotAllowed("GET, HEAD"));

function methodNotAllowed(allow: string) {
  return (_req: Request, res: Response): void => {
    res.setHeader("Allow", allow);
    res.status(405).json({ error: "Method Not Allowed" });
  };
}

/** The latest completion perf row (TTFT/tps/device) for the HUD. */
function lastCompletionPerf() {
  const r = readPerfRows(200).filter((row) => row.event === "completion").at(-1);
  return {
    ttftMs: r?.ttftMs ?? null,
    tokensPerSec: r?.tokensPerSec ?? null,
    totalTokens: r?.totalTokens ?? null,
    backendDevice: r?.backendDevice ?? null,
  };
}

/** Reasoning model ids for triage — loaded once, kept resident by the orchestrator. */
async function triageContext(): Promise<TriageContext> {
  const medpsyId = await orchestrator.getMedpsy();
  const embedId = config.residentMode === "fallback" ? undefined : await orchestrator.getEmbeddings();
  return { medpsyId, embedId };
}

// ── GET /health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  const residentModels = orchestrator.residentRoles();
  const readiness = {
    modelContractVerified,
    medpsyResident: residentModels.includes("medpsy"),
    embeddingsResident: residentModels.includes("embeddings"),
    ragLive: ragLive === true,
    egressGuardArmed: guard.isArmed,
    inferenceRecoveryRequired: sharedInferenceQueue.recoveryRequired,
  };
  const embeddingsReady = config.residentMode === "fallback" || readiness.embeddingsResident;
  res.json({
    ok: true,
    ready: readiness.modelContractVerified && readiness.medpsyResident && embeddingsReady && readiness.ragLive
      && readiness.egressGuardArmed && !readiness.inferenceRecoveryRequired,
    readiness,
    residentModels,
    residentMode: config.residentMode,
    medpsy: config.modelId,
    model: {
      name: modelIdentity.name,
      path: modelIdentity.path,
      sha256: modelIdentity.sha256,
      productRuntime: {
        name: modelIdentity.productRuntime.name,
        version: modelIdentity.productRuntime.version,
      },
      officialRuntime: modelIdentity.officialRuntime,
    },
    chunks: chunkCount(),
    citationMapHealthy: citationMapHealthy(),
    // null until the prewarm self-test runs; true = native ragSearch returns hits; false = store wiped.
    ragLive,
    // H-6: the offline-egress guard's live state — armed (post-prewarm), strict (blocks vs records), and the
    // count of external connection attempts seen (must be 0). Turns the no-egress thesis into an observable.
    egress: { armed: guard.isArmed, strict: guard.isStrict, violations: guard.violations.length },
    inference: { recoveryRequired: sharedInferenceQueue.recoveryRequired, queuedOrActive: sharedInferenceQueue.size },
    diagnostics: runtimeDiagnostics(),
  });
});
app.all("/health", methodNotAllowed("GET, HEAD"));

// ── POST /debug/route ──────────────────────────────────────────────────────────────
// Calibration-only: returns the semantic router's shortlist + best cosine + off-domain verdict for a
// case, WITHOUT running the model. Gated behind TRIAGE0_DEBUG_ROUTE so it never ships in a demo build.
if (config.debugRoute) {
  app.post("/debug/route", async (req: Request, res: Response) => {
    const keys = req.body && typeof req.body === "object" ? Object.keys(req.body) : [];
    const caseText = typeof req.body?.caseText === "string" ? req.body.caseText.trim() : "";
    if (!caseText || caseText.length > 2_000 || keys.some((key) => key !== "caseText")) {
      return res.status(400).json({ error: "caseText must be the only field and contain 1 through 2000 characters." });
    }
    try {
      const { embedId } = await triageContext();
      if (!embedId) return res.status(503).json({ error: "no embeddings model (degraded mode)" });
      const route = await sharedInferenceQueue.submit(
        "debug-route",
        "debug",
        () => routeCase(caseText, embedId),
      ).promise;
      res.json({ best: route.best, offDomain: route.offDomain, shortlist: route.shortlist });
    } catch (err) {
      clientError(res, err, "route debug failed");
    }
  });
  app.all("/debug/route", methodNotAllowed("POST"));
}

const confirmationStore = new ConfirmationStore();
const continuationStore = new ContinuationStore();
const supervisedWorkflow = createSupervisedWorkflow({
  getContext: triageContext,
  routeCase,
  retrieveGrounding,
  triageFromHits,
  confirmationStore,
  continuationStore,
  policyVersion: "restored-workflow-v1",
});
const localPromptRunner = createPromptRunner();
registerRestoredRoutes(app, {
  supervisedWorkflow,
  promptRunner: {
    async run(input, options) {
      const medpsyId = await orchestrator.getMedpsy("assist");
      return localPromptRunner.run(input, { ...options, modelId: medpsyId });
    },
  },
  confirmationStore,
  projectReferenceActions,
  inferenceQueue: sharedInferenceQueue,
  promptModelId: config.modelId,
  performance: lastCompletionPerf,
});

// ── GET /perf-log + /perf-log.csv ──────────────────────────────────────────────────
app.get("/perf-log", (_req: Request, res: Response) => {
  res.json({ rows: readPerfRows(500) });
});
app.all("/perf-log", methodNotAllowed("GET, HEAD"));
app.get("/perf-log.csv", (_req: Request, res: Response) => {
  res.type("text/csv").status(200).send(readPerfCsv(500));
});
app.all("/perf-log.csv", methodNotAllowed("GET, HEAD"));

// Centralised error handler (must be last). Maps body-parser + multer failures to clean JSON instead of
// an HTML 500, so malformed JSON or an oversized upload returns a friendly status and the server stays up.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  const e = err as { type?: string; code?: string; name?: string };
  if (res.headersSent) return next(err);
  if (e?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "Malformed JSON body." });
  process.stderr.write(`[triage-0] unhandled route error :: ${safeErrorName(err)}\n`);
  return res.status(500).json({ error: "Something went wrong on-device." });
});

/** Start listening. Returns the http.Server so tests can use an ephemeral port + close cleanly. */
export function startServer(port = config.port) {
  loadModelContract();
  modelContractVerified = true;
  // Last-line defence: a stray async rejection (e.g. a write to a socket that died at the wrong tick)
  // must never take the whole server down mid-demo. Log and keep serving.
  const onUnhandledRejection = (reason: unknown) => {
    process.stderr.write(`[triage-0] unhandledRejection (ignored, server stays up): ${safeErrorName(reason)}\n`);
  };
  const onUncaughtException = (err: Error) => {
    process.stderr.write(`[triage-0] uncaughtException (ignored, server stays up): ${safeErrorName(err)}\n`);
  };
  process.on("unhandledRejection", onUnhandledRejection);
  process.on("uncaughtException", onUncaughtException);
  const server = app.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    const p = typeof addr === "object" && addr ? addr.port : port;
    process.stdout.write(`Triage-0 listening on http://localhost:${p}  (MedPsy ${config.modelId}, mode=${config.residentMode})\n`);
    // H-7: a fresh clone that skipped `npm run ingest` has an empty citation map (chunkCount()===0), so every
    // triage would abstain and look like intended behavior. Warn LOUDLY at boot (the wiped-native-store case
    // is caught separately by the ragLive self-test below). Also surfaced on /health + a first-load UI banner.
    if (chunkCount() === 0) {
      process.stderr.write(
        "[triage-0] ⚠️  RAG STORE EMPTY: 0 guideline chunks loaded (data/rag/citation-map.json missing). " +
        "Model-assisted reference lookup is unavailable until the WHO corpus is restored and indexed.\n",
      );
    }
  });
  server.once("close", () => {
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("uncaughtException", onUncaughtException);
  });
  // F5: pre-warm the models + the embed engine's cold first-call so the FIRST triage is not a 30-45s cold
  // start (the demo's biggest latency risk). Best-effort, serialized via the inference lock so it never
  // collides with an incoming request, and never blocks listen. Skipped on an ephemeral port (tests own
  // their own model lifecycle) or when TRIAGE0_NO_PREWARM is set.
  if (port !== 0 && config.prewarmEnabled) {
    void sharedInferenceQueue.submit("server-prewarm", "prewarm", async () => {
      try {
        const medpsyId = await orchestrator.getMedpsy();
        const embedId = config.residentMode === "fallback" ? undefined : await orchestrator.getEmbeddings();
        const warm = await retrieveGrounding("child fever cough fast breathing", { medpsyId, embedId });
        // Store-liveness self-test (closes the Phase-1 blind spot): a canonical clinical query MUST return
        // grounding hits. If the native vector store was wiped, this returns 0 while chunkCount() still
        // reports the sidecar count — so warn LOUDLY rather than silently abstain on every case.
        ragLive = warm.topHits.length > 0;
        if (!ragLive) {
          process.stderr.write(
            "[triage-0] ⚠️  RAG STORE EMPTY: a canonical query returned 0 hits. The native store " +
            "(~/.qvac/rag-hyperdb) is likely missing/wiped — every triage will abstain. Run `npm run ingest`.\n",
          );
        }
        // Phase 2: embed the 27 class-router descriptors once now (single batched call) so the first
        // /triage pays nothing for routing.
        if (embedId) await ensureClassPrototypes(embedId);
        process.stdout.write(`[triage-0] models pre-warmed; first triage will be fast (ragLive=${ragLive})\n`);
      } catch (err) {
        process.stderr.write(`[triage-0] pre-warm skipped: ${safeErrorName(err)}\n`);
      }
      // H-6: arm the offline-egress guard in the SERVING process (not just a test/script). Armed LAST, after
      // every model prewarm, so the one disclosed egress — the first-run weight download — is already done
      // and cached. From here any external connection attempt is a real violation and is BLOCKED (strict),
      // converting the "the patient's case never leaves the device" thesis from tested → enforced. Escape
      // hatch: TRIAGE0_EGRESS_NONSTRICT = record-only (still surfaced on /health, but does not block).
      const strict = config.egressStrict;
      guard.arm(strict);
      process.stdout.write(`[triage-0] egress guard armed (${strict ? "strict — external connections blocked" : "record-only"}); the case never leaves the device\n`);
    }).promise;
  }
  return server;
}

// Run directly (`npm start`) but not when imported by a test.
if (process.argv[1] && resolve(process.argv[1]).endsWith("server.ts")) {
  const server = startServer();
  const shutdown = async () => {
    try {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await sharedInferenceQueue.shutdown(5_000);
      // QVAC installs its own SIGINT/SIGTERM listener and owns SDK model/RPC teardown on this path.
      // Calling orchestrator.shutdown() here races that listener and can start a second worker merely
      // to unload models QVAC already released. Imported tests still call orchestrator.shutdown()
      // explicitly because no direct-server signal handler is installed in that case.
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// runTriage is re-exported for callers/tests that want the non-streaming path.
export { runTriage };
