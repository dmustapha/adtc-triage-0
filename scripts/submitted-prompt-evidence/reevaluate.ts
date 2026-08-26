import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluateEvidenceRow, performanceFrom } from "./harness.js";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error("usage: reevaluate <source-evidence.json> <output.json>");
if ([sourcePath, outputPath].some((value) => value.includes("32742482642"))) {
  throw new Error("historical failed-run paths are forbidden");
}
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));
if (source.kind !== "submitted-prompt-evidence" || source.runtime?.name !== "llama.cpp") {
  throw new Error("source must be direct llama.cpp submitted-prompt evidence");
}
const rows = source.rows.map((row: any) => ({
  ...row,
  performance: performanceFrom(row.rawStderr, row.performance.wallTimeMs),
}));
const evaluations = rows.map((row: any) => ({
  caseId: row.caseId,
  ...evaluateEvidenceRow({
    promptId: row.promptId,
    caseKind: row.caseKind,
    rawStdout: row.rawStdout,
    rawStderr: row.rawStderr,
    exitCode: row.exitCode,
    timedOut: row.timedOut,
    performance: row.performance,
  }),
}));
const amendment = {
  schemaVersion: 1,
  kind: "submitted-prompt-evidence-reevaluation",
  sourceEvidence: {
    path: sourcePath,
    sha256: createHash("sha256").update(sourceBytes).digest("hex"),
  },
  status: evaluations.every((item: any) => item.status === "pass") ? "pass" : "fail",
  reason: "Correct generation-speed parsing and fail closed on cap-ended or unclosed reasoning output; raw execution evidence is unchanged.",
  runtime: source.runtime,
  host: source.host,
  model: source.model,
  rows,
  evaluations,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(amendment, null, 2)}\n`, { flag: "wx" });
if (amendment.status !== "pass") process.exitCode = 2;
