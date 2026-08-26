import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

test("the imported English clinical pipeline remains locally grounded and bounded", async () => {
  const triage = await readFile("src/triage/triage.ts", "utf8");
  assert.match(triage, /retrieveGrounding/);
  assert.match(triage, /<<<UNTRUSTED \$\{label\}>>>/);
  assert.match(triage, /REASON pass[\s\S]*EXTRACT pass/);
  assert.match(triage, /responseFormat: \{ type: "json_schema"/);
  assert.match(triage, /TriageExtractSchema\.safeParse/);
  assert.match(triage, /MAX_EXTRACT_ATTEMPTS = 3/);
  assert.match(triage, /reconcileMalaria[\s\S]*reconcileDiarrhoea[\s\S]*finalizeSeverity/);
  assert.match(triage, /grounded\.citation\.(?:title|page)/);
  assert.match(triage, /abstainCard/);
});

test("product generation policy describes the existing QVAC clinical contract", async () => {
  const policy = await readJson("config/product-generation-policy.json");
  assert.equal(policy.kind, "product-generation");
  assert.deepEqual(policy.languageScope, ["en"]);
  assert.deepEqual(policy.runtime, { name: "QVAC SDK", version: "0.13.3" });
  assert.equal(policy.modelContract, "config/canonical-model.json");
  assert.equal(policy.context.mode, "local-rag");
  assert.equal(policy.context.sourceBoundCitations, true);
  assert.deepEqual(policy.passes.map((pass: { name: string }) => pass.name), ["reason", "extract"]);
  assert.equal(policy.passes[0].outputExposure, "internal-only");
  assert.equal(policy.passes[1].constraint, "json-schema-to-GBNF");
  assert.equal(policy.passes[1].maxAttempts, 3);
  assert.deepEqual(policy.deterministicOwners, ["classification-reconciliation", "severity", "red-flags", "protocol-citations", "management-plan"]);
  assert.deepEqual(policy.failureModes, ["abstain", "fail-closed-error"]);
  assert.equal(policy.visibleOutput.chainOfThought, false);
  assert.equal(policy.visibleOutput.briefValidatedJustification, true);
});

test("profiler policy freezes exactly the two public metadata prompts for direct llama.cpp", async () => {
  const metadata = await readJson("metadata.json");
  const policy = await readJson("config/profiler-prompt-policy.json");
  assert.equal(policy.kind, "profiler-prompt");
  assert.equal(policy.runtime, "llama.cpp");
  assert.equal(policy.modelContract, "config/canonical-model.json");
  assert.equal(policy.promptSource, "metadata.json#test_prompts");
  assert.equal(policy.reusesProductOrchestration, false);
  assert.deepEqual(policy.prompts, metadata.test_prompts);
  assert.equal(policy.prompts.length, 2);
});

test("historical finalist generation evidence remains byte-frozen", async () => {
  const bytes = await readFile("config/generation-policy.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "53ee56807c9c61c43bf2347f1289dd1df53786a8c59f943392c4351631a101ca");
});

test("the SSE boundary never exposes model chain-of-thought", async () => {
  const surface = `${await readFile("src/server.ts", "utf8")}\n${await readFile("src/http/create-app.ts", "utf8")}`;
  assert.doesNotMatch(surface, /(?:send|stream\.send)\(["']reasoning["']/);
  assert.match(surface, /stream\.send\(["']stage["']/);
});

test("provisional classification is supervised and source actions remain deterministic", async () => {
  const [workflow, actions] = await Promise.all([
    readFile("src/triage/supervised-workflow.ts", "utf8"),
    readFile("src/triage/reference-actions.ts", "utf8"),
  ]);
  assert.match(workflow, /provisional WHO protocol classification, not a diagnosis/i);
  assert.match(workflow, /confirmation:\s*\{\s*eligible:\s*true,\s*token:/s);
  assert.doesNotMatch(workflow, /referenceActions:\s*result\.card|plan:\s*result\.card/);
  assert.match(actions, /lookupProtocol\(classification\)/);
  assert.doesNotMatch(actions, /modelDraft|retrievedText|reasoning/);
});
