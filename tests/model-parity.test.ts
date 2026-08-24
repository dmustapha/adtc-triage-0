import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

async function modelContractModule() {
  try { return await import("../src/model-contract.js"); }
  catch { return null; }
}

function fixture(options: { writeModel?: boolean; wrongHash?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "adtc-model-contract-"));
  roots.push(root);
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, "model"));
  const bytes = Buffer.from("canonical fixture, not model weights\n");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = "model/fixture.gguf";
  const canonical = {
    ...JSON.parse(readFileSync("config/canonical-model.json", "utf8")),
    filename: "fixture.gguf", path, bytes: bytes.length,
    sha256: options.wrongHash ? "0".repeat(64) : sha256,
    productRuntime: { name: "QVAC SDK", version: "0.13.3", modelPath: path },
  };
  const metadata = {
    ...JSON.parse(readFileSync("metadata.json", "utf8")),
    _runtime: { model_path: path },
  };
  writeFileSync(join(root, "config", "canonical-model.json"), JSON.stringify(canonical));
  writeFileSync(join(root, "metadata.json"), JSON.stringify(metadata));
  if (options.writeModel !== false) writeFileSync(join(root, path), bytes);
  return root;
}

test("model-contract loader verifies the canonical fixture", async () => {
  const module = await modelContractModule();
  assert.ok(module, "model-contract loader must exist");
  const contract = module.loadModelContract(fixture());
  assert.equal(contract.candidateId, "medpsy-1.7b-q4");
  assert.match(contract.absolutePath, /model\/fixture\.gguf$/);
});

test("model-contract loader fails closed when the GGUF is missing", async () => {
  const module = await modelContractModule();
  assert.ok(module, "model-contract loader must exist");
  assert.throws(() => module.loadModelContract(fixture({ writeModel: false })), /missing canonical model/i);
});

test("model-contract loader fails closed when the GGUF hash is wrong", async () => {
  const module = await modelContractModule();
  assert.ok(module, "model-contract loader must exist");
  assert.throws(() => module.loadModelContract(fixture({ wrongHash: true })), /hash mismatch/i);
});

test("profiler path comes from metadata and matches the canonical GGUF", async () => {
  const module = await modelContractModule();
  assert.ok(module, "model-contract loader must exist");
  const root = fixture();
  assert.equal(module.profilerModelPath(root), "model/fixture.gguf");
  assert.equal(module.readModelIdentity(root).path, module.profilerModelPath(root));
});

test("health distinguishes canonical identity and both runtimes", async () => {
  const { app } = await import("../src/server.js");
  const server = await new Promise<any>((resolve) => {
    const active = app.listen(0, () => resolve(active));
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const health = await response.json();
    assert.equal(health.model.name, "MedPsy-1.7B-Q4_K_M-imatrix");
    assert.equal(health.model.path, "model/medpsy-1.7b-q4_k_m-imat.gguf");
    assert.equal(health.model.sha256, "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880");
    assert.deepEqual(health.model.productRuntime, { name: "QVAC SDK", version: "0.13.3" });
    assert.equal(health.model.officialRuntime, "llama.cpp");
  } finally {
    server.close();
  }
});

test("startServer fails before listening when the canonical GGUF is absent", async () => {
  const { startServer } = await import("../src/server.js");
  let started: { close(): void } | undefined;
  try {
    assert.throws(() => { started = startServer(0); }, /missing canonical model/i);
  } finally {
    started?.close();
  }
});

test("active model identity contains no OLMo path", async () => {
  const module = await modelContractModule();
  assert.ok(module, "model-contract loader must exist");
  const active = JSON.stringify({ identity: module.readModelIdentity(), metadata: JSON.parse(readFileSync("metadata.json", "utf8")) });
  assert.doesNotMatch(active, /olmo/i);
});
