import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const candidateId = "olmo-2-0425-1b-instruct-q4-k-m";
const llamaArgs = ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "-no-cnv"];
const [modeOrOutput, requestedOutput] = process.argv.slice(2);
const planOnly = modeOrOutput === "--plan-only";
const outputPath = planOnly ? requestedOutput : modeOrOutput;
if (!outputPath) throw new Error("usage: produce-replacement-ci-evidence [--plan-only] <output.json>");

const status: Record<string, unknown> = {
  schemaVersion: 1,
  candidateId,
  quantization: "GGUF Q4_K_M",
  producer: "github-actions",
  llamaRevision: "c8ade30036139e32108fee53d8b7164dbfda4bee",
  llamaArgs,
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
  const responseCount = raw.trim().split("\n").filter(Boolean).length;
  if (responseCount !== 100) throw new Error(`expected 100 raw responses, received ${responseCount}`);
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
