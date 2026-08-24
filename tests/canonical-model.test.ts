import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const EXPECTED = {
  candidateId: "medpsy-1.7b-q4",
  revision: "fd4cecc90c2de8dce4b112795456a54be9c59363",
  filename: "medpsy-1.7b-q4_k_m-imat.gguf",
  path: "model/medpsy-1.7b-q4_k_m-imat.gguf",
  bytes: 1_282_439_360,
  sha256: "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880",
} as const;

const EXPECTED_METADATA_MODEL = {
  name: "MedPsy-1.7B-Q4_K_M-imatrix",
  runtime: "llama.cpp",
  quantization: "GGUF Q4_K_M",
  parameters_estimate: "2.03B",
  packaging: "binary_bundle",
} as const;

const IDENTITY_PLACEHOLDERS = {
  team_id: "your-team-id",
  submitter: {
    name: "your-name",
    email: "your-email@domain.com",
    github_handle: "your-github",
  },
} as const;

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

test("canonical MedPsy identity is exact and public", () => {
  const canonical = json("config/canonical-model.json");

  for (const [key, value] of Object.entries(EXPECTED)) assert.equal(canonical[key], value, key);
  assert.match(canonical.url, /^https:\/\/huggingface\.co\/qvac\/MedPsy-1\.7B-GGUF\/resolve\//);
  assert.match(canonical.url, new RegExp(EXPECTED.revision));
  assert.doesNotMatch(canonical.url, /token=|authorization|cookie/i);
  assert.deepEqual(canonical.languageScope, ["en"]);
  assert.equal(canonical.officialRuntime, "llama.cpp");
  assert.deepEqual(canonical.productRuntime, { name: "QVAC SDK", version: "0.13.3", modelPath: EXPECTED.path });
});

test("metadata, finalist, and checksum record share the canonical identity", () => {
  const canonical = json("config/canonical-model.json");
  const metadata = json("metadata.json");
  const finalist = json("config/model-finalists.json")[EXPECTED.candidateId];
  const checksum = readFileSync("evidence/medpsy-shared-runtime-v1/model.sha256", "utf8");

  assert.equal(metadata.domain, "healthcare_medical");
  assert.deepEqual(metadata.language_scope, ["en"]);
  assert.equal(metadata.african_alpha_claim, false);
  assert.deepEqual(metadata.model, EXPECTED_METADATA_MODEL);
  assert.equal(metadata._runtime.model_path, EXPECTED.path);
  assert.equal(finalist.outputPath, EXPECTED.path);
  for (const key of ["candidateId", "revision", "filename", "bytes", "sha256"] as const) {
    assert.equal(finalist[key], canonical[key], key);
  }
  assert.equal(checksum, `${EXPECTED.sha256}  ${EXPECTED.path}\n`);
});

test("metadata remains English-only without unsupported language claims", () => {
  const metadata = json("metadata.json");
  const claims = JSON.stringify({
    language_scope: metadata.language_scope,
    african_alpha_claim: metadata.african_alpha_claim,
    prompts: metadata.test_prompts,
    pairing: metadata.cross_disciplinary_pairing,
  });

  assert.deepEqual(metadata.language_scope, ["en"]);
  assert.equal(metadata.african_alpha_claim, false);
  assert.doesNotMatch(claims, /multilingual|African[- ]language|French|Swahili|Yoruba|Hausa|Igbo/i);
});

test("explicit identity placeholders keep final packaging blocked", () => {
  const metadata = json("metadata.json");

  assert.equal(metadata.team_id, IDENTITY_PLACEHOLDERS.team_id);
  assert.deepEqual(metadata.submitter, IDENTITY_PLACEHOLDERS.submitter);
  const blockers = [metadata.team_id, ...Object.values(metadata.submitter)].filter((value) =>
    /^your-|@domain\.com$/i.test(String(value)),
  );
  assert.equal(blockers.length, 4, "final packaging must fail until all four real identity values are supplied");
});

test("canonical model schema requires every shared-runtime identity field", () => {
  const schema = json("config/canonical-model.schema.json");
  const required = new Set(schema.required);
  for (const key of [...Object.keys(EXPECTED), "url", "languageScope", "officialRuntime", "productRuntime"]) {
    assert.ok(required.has(key), `${key} is required`);
  }
  assert.equal(schema.additionalProperties, false);
});
