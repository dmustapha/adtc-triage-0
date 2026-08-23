import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
function run(script: string, args: string[] = [], cwd = root) {
  return spawnSync(process.execPath, ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, script), ...args], { cwd, encoding: "utf8" });
}

test("release key creation writes a mode-0600 private key and refuses overwrite", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "release-key-"));
  await mkdir(join(cwd, "config"));
  const first = run("scripts/create-release-key.ts", [], cwd);
  assert.equal(first.status, 0, first.stderr);
  assert.equal((await stat(join(cwd, ".release-private-key.pem"))).mode & 0o777, 0o600);
  const second = run("scripts/create-release-key.ts", [], cwd);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /refusing to overwrite release key/);
});

test("chat-template extraction rejects a candidate/path mismatch before reading bytes", () => {
  const result = run("scripts/extract-gguf-chat-template.ts", ["medpsy-1.7b-q4", "model/wrong.gguf"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /candidate\/path mismatch/);
  const fixedRawPath = run("scripts/extract-gguf-chat-template.ts", ["medpsy-1.7b-q4", "model/medpsy-1.7b-q4.gguf"]);
  assert.notEqual(fixedRawPath.status, 0);
  assert.doesNotMatch(fixedRawPath.stderr, /candidate\/path mismatch/);
  assert.match(fixedRawPath.stderr, /ENOENT/);
});

test("bundle builder refuses an incomplete producer descriptor", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "finalist-index-")), "index.json");
  await writeFile(path, JSON.stringify({ gates: {}, comparison: {} }));
  const result = run("scripts/build-finalist-bundle.ts", ["medpsy-1.7b-q4", path]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /evidence index gate set invalid/);
});

test("finalist gate requires candidate, bundle, and signer", () => {
  const result = run("scripts/run-finalist-gate.ts");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: npm run finalist-gate/);
});

test("replacement workflow pins artifact/runtime and never uploads model weights", async () => {
  const workflow = await readFile(".github/workflows/olmo-replacement-evidence.yml", "utf8");
  assert.match(workflow, /62f8c199538474c3e33ed5d7e0580abd66686a27/);
  assert.match(workflow, /abd8187934a438fbf7cfff0a1de5b9d2793ce913f158794df1951dcba6c93cc6/);
  assert.match(workflow, /935515296/);
  assert.match(workflow, /c8ade30036139e32108fee53d8b7164dbfda4bee/);
  assert.match(workflow, /curl --fail --location --retry 5 --retry-all-errors --retry-delay 5 --http1\.1/);
  assert.match(workflow, /--continue-at - --output "model\/\$CANDIDATE_ID\.gguf\.partial"/);
  assert.match(workflow, /mv "model\/\$CANDIDATE_ID\.gguf\.partial" "model\/\$CANDIDATE_ID\.gguf"/);
  assert.match(workflow, /scripts\/run-raw-finalist\.ts/);
  assert.doesNotMatch(workflow, /path:\s*model\//);
});

test("raw producer forces one-shot completion and bounds every case", async () => {
  const producer = await readFile("scripts/run-raw-finalist.ts", "utf8");
  assert.match(producer, /"-no-cnv"/);
  assert.match(producer, /timeout:\s*120_000/);
  assert.match(producer, /START raw case/);
  assert.match(producer, /COMPLETE raw case/);
});

test("CI evidence producer leaves human and physical gates unresolved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "replacement-ci-"));
  const output = join(dir, "status.json");
  const result = run("scripts/produce-replacement-ci-evidence.ts", ["--plan-only", output]);
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(await readFile(output, "utf8"));
  assert.equal(status.candidateId, "olmo-2-0425-1b-instruct-q4-k-m");
  assert.equal(status.gates.humanRubric.status, "unresolved");
  assert.equal(status.gates.targetLaptopResources.status, "unresolved");
  assert.equal(status.gates.targetLaptopResources.observedTier, "remote-ci");
  assert.deepEqual(status.llamaArgs, ["-t", "4", "-ngl", "0", "-c", "2048", "-n", "128", "--temp", "0", "-no-cnv"]);
});
