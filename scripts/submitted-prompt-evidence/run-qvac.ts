import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { medpsySpec } from "../../src/config.js";
import { completionTimed, loadModelTimed, unloadModelTimed } from "../../src/qvac/engine.js";
import { loadPromptContract } from "./harness.js";
import { buildQvacEvidence } from "./qvac-harness.js";

const [outputPath] = process.argv.slice(2);
if (!outputPath) throw new Error("usage: run-qvac <output.json>");
if (outputPath.includes("32742482642")) throw new Error("historical failed-run paths are forbidden");

const canonical = JSON.parse(await readFile("config/canonical-model.json", "utf8"));
const sdkPackage = JSON.parse(await readFile("node_modules/@qvac/sdk/package.json", "utf8"));
const modelDigest = createHash("sha256");
for await (const chunk of createReadStream(canonical.path)) modelDigest.update(chunk);
const modelStat = await stat(canonical.path);
const modelSha256 = modelDigest.digest("hex");
if (modelStat.size !== canonical.bytes || modelSha256 !== canonical.sha256) throw new Error("GGUF identity mismatch");

const contract = await loadPromptContract(process.cwd());
const loaded = await loadModelTimed(medpsySpec(), "submitted-prompt-qvac-load");
const outputs = [];
try {
  for (const prompt of contract.prompts) {
    const started = performance.now();
    const result = await completionTimed({
      modelId: loaded.modelId,
      history: [{ role: "user", content: prompt.metadataPrompt }],
      phase: `submitted-prompt-qvac-${prompt.promptId}`,
      generationParams: { predict: 128, temp: 0, reasoning_budget: 0 },
    });
    outputs.push({
      promptId: prompt.promptId,
      text: result.text,
      durationMs: Math.round(performance.now() - started),
      stats: result.stats,
    });
  }
} finally {
  await unloadModelTimed(loaded.modelId, "medpsy", "submitted-prompt-qvac-unload");
}

const evidence = buildQvacEvidence({
  prompts: contract.prompts.map((prompt) => ({
    promptId: prompt.promptId,
    prompt: prompt.metadataPrompt,
    sha256: prompt.sha256,
  })),
  outputs,
  sdkVersion: sdkPackage.version,
  hostLabel: process.env.EVIDENCE_HOST?.trim() || `${hostname()} Apple development host`,
  model: { bytes: modelStat.size, sha256: modelSha256, path: canonical.path },
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
if (evidence.status !== "pass") process.exitCode = 2;
