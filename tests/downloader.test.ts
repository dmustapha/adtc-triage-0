import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

function fixture(expected: { bytes?: number; sha256?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "adtc-downloader-"));
  roots.push(root);
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, "bin"));
  const source = join(root, "fixture.gguf");
  const contents = Buffer.from("small fixture bytes, never model weights\n");
  writeFileSync(source, contents);
  cpSync("download_model.sh", join(root, "download_model.sh"));
  const sha256 = createHash("sha256").update(contents).digest("hex");
  writeFileSync(join(root, "config", "canonical-model.json"), JSON.stringify({
    url: `file://${source}`,
    path: "model/fixture.gguf",
    bytes: expected.bytes ?? contents.length,
    sha256: expected.sha256 ?? sha256,
  }));
  const curlStub = join(root, "bin", "curl");
  writeFileSync(curlStub, `#!/usr/bin/env bash
set -euo pipefail
out=""
while (( $# )); do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    http://*|https://*) echo "network forbidden in downloader test" >&2; exit 90 ;;
    *) shift ;;
  esac
done
test -n "$out"
cp "$CURL_FIXTURE_SOURCE" "$out"
`);
  chmodSync(curlStub, 0o755);
  return { root, contents };
}

function run(root: string) {
  return spawnSync("bash", [join(root, "download_model.sh")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CURL_FIXTURE_SOURCE: join(root, "fixture.gguf"),
      PATH: `${join(root, "bin")}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    },
  });
}

test("downloader verifies fixture bytes and atomically installs once", () => {
  const { root, contents } = fixture();
  const first = run(root);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf")), contents);
  assert.equal(existsSync(join(root, "model", "fixture.gguf.partial")), false);

  const second = run(root);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already present and verified/i);
});

test("downloader rejects a wrong byte count without publishing a final file", () => {
  const { root } = fixture({ bytes: 1 });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /size mismatch/i);
  assert.throws(() => readFileSync(join(root, "model", "fixture.gguf")));
});

test("downloader rejects a wrong hash without publishing a final file", () => {
  const { root } = fixture({ sha256: "0".repeat(64) });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sha-256 mismatch/i);
  assert.throws(() => readFileSync(join(root, "model", "fixture.gguf")));
});
