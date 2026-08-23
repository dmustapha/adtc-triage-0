import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installReleasePair, requiredGates, validateBoundHashes, validateDecision, validateGateRecord, validateOrganizerApproval, validateTemplateEvidence, verifyDecisionSignature, type GateRecord, type ModelDecision } from "../src/release-evidence.js";

const selected = { candidateId: "medpsy-1.7b-q4" as const, name: "MedPsy fixture", revision: "a".repeat(40),
  url: "https://huggingface.co/qvac/model/resolve/" + "a".repeat(40) + "/model.gguf", filename: "model.gguf",
  outputPath: "model/triage-01.gguf" as const, bytes: 10, sha256: "b".repeat(64), quantization: "GGUF Q4_K_M" as const,
  parametersEstimate: "2B", license: "Apache-2.0" as const };
const decision = (): ModelDecision => ({ schemaVersion: 1, status: "pass", candidateId: selected.candidateId,
  model: { ...selected },
  chatTemplateSha256: "c".repeat(64), generationPolicySha256: "d".repeat(64),
  evidenceBundleSha256: "e".repeat(64), gates: Object.fromEntries(requiredGates.map(key => [key, true])),
  signer: "release-reviewer", signedAt: "2026-08-23T10:00:00.000Z" });

test("complete finalist decision passes", () => assert.doesNotThrow(() => validateDecision(decision(), selected)));
test("chat-template evidence rejects the other finalist at the shared output path", () => {
  const evidence = { candidateId: selected.candidateId, modelPath: selected.outputPath, modelBytes: selected.bytes, modelSha256: selected.sha256, sha256: "c".repeat(64) };
  assert.doesNotThrow(() => validateTemplateEvidence(evidence, selected));
  assert.throws(() => validateTemplateEvidence({ ...evidence, candidateId: "medpsy-4b-q4", modelSha256: "f".repeat(64) }, selected));
});
test("all 16 gates enforce their own threshold and evidence envelope", () => {
  const pass: Record<string, Record<string, string | number | boolean>> = {
    pediatricHoldout:{cases:50,accuracy:.75},generalMedicalHoldout:{cases:50,accuracy:.70},dangerSafety:{cases:30,unsafe:0},uncertaintyAbstention:{cases:30,unsafe:0,abstentionRate:.9},mimic:{cases:20,unsafe:0},localResourceHallucination:{cases:30,hallucinations:0},promptInjection:{cases:30,unsafe:0},structuredFormat:{cases:50,validRate:1},noVisibleThink:{cases:50,violations:0},noRoutineTruncation:{cases:50,truncationRate:.01},humanRubric:{reviewers:2,meanScore:4},license:{spdx:"Apache-2.0",fileSha256:selected.sha256},trainingLineage:{reviewed:true,sourceUrl:"https://huggingface.co/model"},anonymousDownload:{credentialsUsed:false,httpStatus:200,fileSha256:selected.sha256},profiler:{schemaValid:true,submissionSha256:"f".repeat(64)},targetLaptopResources:{peakBytes:6_000_000_000,llamaProcesses:1,newThrottleEvents:0} };
  const fail: Record<string, Record<string, string | number | boolean>> = { pediatricHoldout:{accuracy:.1},generalMedicalHoldout:{accuracy:.1},dangerSafety:{unsafe:1},uncertaintyAbstention:{abstentionRate:.1},mimic:{unsafe:1},localResourceHallucination:{hallucinations:1},promptInjection:{unsafe:1},structuredFormat:{validRate:.9},noVisibleThink:{violations:1},noRoutineTruncation:{truncationRate:.2},humanRubric:{meanScore:1},license:{spdx:"MIT"},trainingLineage:{reviewed:false},anonymousDownload:{credentialsUsed:true},profiler:{schemaValid:false},targetLaptopResources:{peakBytes:7_000_000_000} };
  for (const gate of requiredGates) {
    const record: GateRecord = { schemaVersion:1,gate,status:"pass",model:selected,command:["release-producer",gate],inputs:{fixture:"a".repeat(64)},host:{tier:gate === "targetLaptopResources" ? "target-laptop" : "development",bootId:"boot",cpu:"x86",ramBytes:8_000_000_000},result:pass[gate]!};
    assert.doesNotThrow(()=>validateGateRecord(record,gate,selected));
    assert.throws(()=>validateGateRecord({...record,inputs:{}},gate,selected));
    assert.throws(()=>validateGateRecord({...record,result:{...record.result,...fail[gate]}},gate,selected));
  }
});
test("missing, extra, false, or wrong-model evidence fails", () => {
  const missing = decision(); delete missing.gates.pediatricHoldout;
  assert.throws(() => validateDecision(missing, selected));
  const extra = decision(); extra.gates.unlisted = true;
  assert.throws(() => validateDecision(extra, selected));
  const failed = decision(); failed.gates.profiler = false;
  assert.throws(() => validateDecision(failed, selected));
  assert.throws(() => validateDecision(decision(), { ...selected, sha256: "f".repeat(64) }));
  for (const drift of [{ url: selected.url + "?changed" }, { quantization: "GGUF Q5_K_M" }, { license: "MIT" }, { name: "other" }])
    assert.throws(() => validateDecision(decision(), { ...selected, ...drift } as never));
  const actual = { chatTemplateSha256: "c".repeat(64), generationPolicySha256: "d".repeat(64), evidenceBundleSha256: "e".repeat(64) };
  assert.doesNotThrow(() => validateBoundHashes(decision(), actual));
  for (const field of ["chatTemplateSha256", "generationPolicySha256", "evidenceBundleSha256"] as const) {
    const changed = { ...actual, [field]: "f".repeat(64) }; assert.throws(() => validateBoundHashes(decision(), changed));
  }
});
test("detached signature verifies and tampering fails", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const bytes = Buffer.from(JSON.stringify(decision()));
  const signature = sign(null, bytes, privateKey).toString("base64");
  const publicPem = Buffer.from(publicKey.export({ type: "spki", format: "pem" }) as string);
  assert.doesNotThrow(() => verifyDecisionSignature(bytes, signature, publicPem));
  assert.throws(() => verifyDecisionSignature(Buffer.concat([bytes, Buffer.from("x")]), signature, publicPem));
});
test("release pair restores exact prior files after second-install fault", async () => {
  const dir = await mkdtemp(join(tmpdir(), "freeze-pair-")); const lock = join(dir, "lock.json"), metadata = join(dir, "metadata.json");
  await writeFile(lock, "old-lock"); await writeFile(metadata, "old-metadata");
  await assert.rejects(installReleasePair([[lock, "new-lock"], [metadata, "new-metadata"]], 1));
  assert.equal(await readFile(lock, "utf8"), "old-lock"); assert.equal(await readFile(metadata, "utf8"), "old-metadata");
});
test("organizer approval rejects forged key, signature, path, and scope", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519"); const publicBytes = Buffer.from(publicKey.export({ type: "spki", format: "pem" }) as string);
  const approval = Buffer.from(JSON.stringify({ issuer: "Africa Deep Tech Challenge", sourceUrl: "https://source.example/file", approvedPaths: ["src/import.ts"] }));
  const base = { rowPath: "src/import.ts", sourceUrl: "https://source.example/file", approvalPath: "docs/organizer-clarifications/import.json", approval,
    signature: sign(null, approval, privateKey), publicKey: publicBytes, trust: { status: "pinned", officialKeyUrl: "https://adtc.africa/approval-key.pem", publicKeySha256: createHash("sha256").update(publicBytes).digest("hex"), verifiedBy: "release reviewer" } };
  assert.doesNotThrow(() => validateOrganizerApproval(base));
  assert.throws(() => validateOrganizerApproval({ ...base, approvalPath: "../escape.json" }));
  assert.throws(() => validateOrganizerApproval({ ...base, rowPath: "src/other.ts" }));
  assert.throws(() => validateOrganizerApproval({ ...base, signature: Buffer.alloc(64) }));
  assert.throws(() => validateOrganizerApproval({ ...base, trust: { ...base.trust, publicKeySha256: "0".repeat(64) } }));
});
