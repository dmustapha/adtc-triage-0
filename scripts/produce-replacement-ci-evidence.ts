import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const candidateId = "olmo-2-0425-1b-instruct-q4-k-m";
const llamaArgs = ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--jinja", "--single-turn"];
const [modeOrOutput, requestedOutput] = process.argv.slice(2);
const planOnly = modeOrOutput === "--plan-only";
const outputPath = planOnly ? requestedOutput : modeOrOutput;
if (!outputPath) throw new Error("usage: produce-replacement-ci-evidence [--plan-only] <output.json>");

const selectedCandidateId = process.env.CANDIDATE_ID ?? candidateId;
const inputPaths = {
  corpus: "config/finalist-corpus.json",
  rubric: "config/finalist-rubric.json",
  generationPolicy: "config/generation-policy.json",
  rawProducer: "scripts/run-raw-finalist.ts",
  evidenceProducer: "scripts/produce-replacement-ci-evidence.ts",
  workflow: ".github/workflows/olmo2-7b-recovery-evidence.yml"
};
const inputBytes = Object.fromEntries(await Promise.all(Object.entries(inputPaths).map(async ([key, path]) => [key, await readFile(path)]))) as Record<keyof typeof inputPaths, Buffer>;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const corpus = JSON.parse(inputBytes.corpus.toString("utf8"));
const cases = [...corpus.splits.pediatricHoldout, ...corpus.splits.generalMedicalHoldout];
const expectedCommand = (prompt: string) => ["llama-cli", "-m", `model/${selectedCandidateId}.gguf`, "-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "--no-display-prompt", "--jinja", "--single-turn", "-p", prompt];

const status: Record<string, unknown> = {
  schemaVersion: 1,
  candidateId: selectedCandidateId,
  quantization: "GGUF Q4_K_M",
  producer: "github-actions",
  llamaRevision: "c8ade30036139e32108fee53d8b7164dbfda4bee",
  llamaArgs,
  corpus: { path: inputPaths.corpus, splits: { pediatricHoldout: corpus.splits.pediatricHoldout.length, generalMedicalHoldout: corpus.splits.generalMedicalHoldout.length } },
  inputHashes: Object.fromEntries(Object.entries(inputBytes).map(([key, bytes]) => [key, digest(bytes)])),
  gates: {
    humanRubric: { status: "unresolved", reason: "requires two independent human reviewers" },
    targetLaptopResources: {
      status: "unresolved",
      observedTier: "remote-ci",
      reason: "a hosted CI runner cannot certify the frozen target-laptop tier"
    }
  }
};

if (!planOnly) {
  const rawPath = process.env.RAW_RESPONSE_PATH;
  if (!rawPath) throw new Error("RAW_RESPONSE_PATH is required outside plan-only mode");
  const raw = await readFile(rawPath, "utf8");
  const rows = raw.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  const responseCount = rows.length;
  if (responseCount !== 100) throw new Error(`expected 100 raw responses, received ${responseCount}`);
  if (new Set(rows.map(row => row.caseId)).size !== 100) throw new Error("expected 100 unique raw response case IDs");
  const casesById = new Map(cases.map(item => [item.id, item]));
  for (const row of rows) {
    const item = casesById.get(row.caseId);
    if (!item || row.candidateId !== selectedCandidateId || JSON.stringify(row.command) !== JSON.stringify(expectedCommand(item.prompt))) {
      throw new Error(`raw response command identity mismatch: ${row.caseId}`);
    }
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(rawPath)) hash.update(chunk);
  Object.assign(status, {
    producedAt: new Date().toISOString(),
    workflowRunId: process.env.GITHUB_RUN_ID ?? "unknown",
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "unknown",
    runner: { os: process.env.RUNNER_OS ?? "unknown", arch: process.env.RUNNER_ARCH ?? "unknown", cpuOnly: true },
    rawEvidence: { path: rawPath, bytes: (await stat(rawPath)).size, sha256: hash.digest("hex"), responseCount }
  });
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(status, null, 2) + "\n", { flag: "wx" });
console.log(`wrote ${planOnly ? "plan" : "CI"} evidence to ${outputPath}`);
