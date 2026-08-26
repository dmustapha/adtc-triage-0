import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { evaluateProductExecution } from "./product-harness.js";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error("usage: evaluate-product <source.json> <output.json>");
if ([sourcePath, outputPath].some((value) => value.includes("32742482642"))) {
  throw new Error("historical failed-run paths are forbidden");
}
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));
if (source.kind !== "submitted-prompt-product-evidence") throw new Error("source is not product prompt evidence");
const evaluations = source.executions.map((execution: any) => ({
  caseId: execution.caseId,
  ...evaluateProductExecution(execution),
}));
const status = evaluations.every((item: any) => item.status === "pass") ? "pass" : "fail";
const evidence = {
  schemaVersion: 1,
  kind: "submitted-prompt-product-reevaluation",
  status,
  source: { path: sourcePath, sha256: createHash("sha256").update(sourceBytes).digest("hex") },
  reason: "Re-evaluate every public result field, keep hostile suffixes outside authority-bearing facts, and reject invented clinical numbers.",
  evaluations,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
if (status !== "pass") process.exitCode = 2;
