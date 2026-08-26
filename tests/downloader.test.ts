import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

function fixture(expected: { bytes?: number; sha256?: string; hf?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), "adtc-downloader-"));
  roots.push(root);
  mkdirSync(join(root, "config"));
  mkdirSync(join(root, "bin"));
  const source = join(root, "fixture.gguf");
  const contents = Buffer.from("small fixture bytes, never model weights\n");
  writeFileSync(source, contents);
  cpSync("download_model.sh", join(root, "download_model.sh"));
  const sha256 = createHash("sha256").update(contents).digest("hex");
  const url = expected.hf
    ? "https://huggingface.co/qvac/Fixture-GGUF/resolve/fixture-revision/fixture.gguf"
    : `file://${source}`;
  writeFileSync(join(root, "config", "canonical-model.json"), JSON.stringify({
    url,
    revision: "fixture-revision",
    filename: "fixture.gguf",
    path: "model/fixture.gguf",
    bytes: expected.bytes ?? contents.length,
    sha256: expected.sha256 ?? sha256,
  }));
  const curlStub = join(root, "bin", "curl");
  writeFileSync(curlStub, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$CURL_ARGS_LOG"
out=""
range=""
while (( $# )); do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --range) range="$2"; shift 2 ;;
    http://*|https://*) [[ "\${CURL_ALLOW_NETWORK_STUB:-}" == "1" ]] || { echo "network forbidden in downloader test" >&2; exit 90; }; shift ;;
    *) shift ;;
  esac
done
test -n "$out"
if [[ -n "$range" ]]; then
  start="\${range%%-*}"
  end="\${range##*-}"
  count="$((end - start + 1))"
  if [[ "\${CURL_TRUNCATE_RANGE:-}" == "$range" ]]; then count="$((count - 1))"; fi
  dd if="$CURL_FIXTURE_SOURCE" of="$out" bs=1 skip="$start" count="$count" status=none
else
  cp "$CURL_FIXTURE_SOURCE" "$out"
fi
`);
  chmodSync(curlStub, 0o755);
  return { root, contents };
}

function installHfStub(root: string) {
  const hfStub = join(root, "bin", "hf");
  writeFileSync(hfStub, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > "$HF_ARGS_LOG"
[[ "$1" == "download" ]]
filename="$3"
shift 3
local_dir=""
while (( $# )); do
  case "$1" in
    --revision) shift 2 ;;
    --local-dir) local_dir="$2"; shift 2 ;;
    *) exit 91 ;;
  esac
done
mkdir -p "$local_dir"
if [[ "\${HF_BAD_CONTENT:-}" == "1" ]]; then
  printf 'bad staged bytes' > "$local_dir/$filename"
else
  cp "$CURL_FIXTURE_SOURCE" "$local_dir/$filename"
fi
`);
  chmodSync(hfStub, 0o755);
}

function run(root: string, extraEnv: Record<string, string> = {}) {
  return spawnSync("bash", [join(root, "download_model.sh")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CURL_FIXTURE_SOURCE: join(root, "fixture.gguf"),
      CURL_ARGS_LOG: join(root, "curl-args.log"),
      MODEL_DOWNLOAD_SEGMENT_BYTES: "8",
      MODEL_DOWNLOAD_PARALLELISM: "3",
      PATH: `${join(root, "bin")}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      ...extraEnv,
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

test("hf engine pins repo revision and filename while preserving curl progress", () => {
  const { root, contents } = fixture({ hf: true });
  installHfStub(root);
  mkdirSync(join(root, "model", "fixture.gguf.partial.segments"), { recursive: true });
  const partial = contents.subarray(0, 7);
  writeFileSync(join(root, "model", "fixture.gguf.partial"), partial);
  writeFileSync(join(root, "model", "fixture.gguf.partial.segments", "marker"), "keep");
  const result = run(root, {
    MODEL_DOWNLOAD_ENGINE: "hf",
    HF_ARGS_LOG: join(root, "hf-args.log"),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf")), contents);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf.partial")), partial);
  assert.equal(readFileSync(join(root, "model", "fixture.gguf.partial.segments", "marker"), "utf8"), "keep");
  const args = readFileSync(join(root, "hf-args.log"), "utf8");
  assert.match(args, /^download qvac\/Fixture-GGUF fixture\.gguf --revision fixture-revision --local-dir /);
});

test("hf engine never publishes staged bytes that fail exact verification", () => {
  const { root } = fixture({ hf: true });
  installHfStub(root);
  const result = run(root, {
    MODEL_DOWNLOAD_ENGINE: "hf",
    HF_ARGS_LOG: join(root, "hf-args.log"),
    HF_BAD_CONTENT: "1",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /staged model failed verification/i);
  assert.equal(existsSync(join(root, "model", "fixture.gguf")), false);
});

test("hf engine safely falls back to curl when the hf command is unavailable", () => {
  const { root, contents } = fixture({ hf: true });
  const result = run(root, {
    MODEL_DOWNLOAD_ENGINE: "hf",
    CURL_ALLOW_NETWORK_STUB: "1",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /hf command unavailable.*falling back to curl/i);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf")), contents);
});

test("downloader forces bounded parallel HTTP/1.1 range retries", () => {
  const { root } = fixture();
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(join(root, "curl-args.log"), "utf8").trim().split("\n");
  assert.ok(calls.length > 1, "large transfers must use more than one range request");
  assert.ok(calls.every((call) => call.includes("--http1.1")));
  assert.ok(calls.every((call) => call.includes("--retry-all-errors")));
  assert.ok(calls.every((call) => call.includes("--range")));
});

test("downloader resumes after an existing partial and appends verified ranges in order", () => {
  const { root, contents } = fixture();
  mkdirSync(join(root, "model"));
  writeFileSync(join(root, "model", "fixture.gguf.partial"), contents.subarray(0, 7));
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf")), contents);
  const calls = readFileSync(join(root, "curl-args.log"), "utf8");
  assert.match(calls, /--range 7-14/);
  assert.doesNotMatch(calls, /--range 0-/);
});

test("downloader never appends a short range to an existing partial", () => {
  const { root, contents } = fixture();
  mkdirSync(join(root, "model"));
  const initial = contents.subarray(0, 7);
  writeFileSync(join(root, "model", "fixture.gguf.partial"), initial);
  const result = run(root, { CURL_TRUNCATE_RANGE: "15-22" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /segment size mismatch/i);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf.partial")), initial);
});

test("downloader schedules sixteen ordered ranges and reuses existing segments", () => {
  const { root, contents } = fixture();
  const segmentDir = join(root, "model", "fixture.gguf.partial.segments");
  mkdirSync(segmentDir, { recursive: true });
  for (let start = 0; start < 16; start += 2) {
    writeFileSync(join(segmentDir, `${start}-${start + 1}`), contents.subarray(start, start + 2));
  }
  const result = run(root, {
    MODEL_DOWNLOAD_SEGMENT_BYTES: "2",
    MODEL_DOWNLOAD_PARALLELISM: "16",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(root, "model", "fixture.gguf")), contents);
  const calls = readFileSync(join(root, "curl-args.log"), "utf8");
  assert.match(calls, /--range 16-17/);
  assert.doesNotMatch(calls, /--range (?:0-1|2-3|4-5|6-7|8-9|10-11|12-13|14-15)(?:\s|$)/);
});

test("downloader rejects unsafe parallelism above its hard cap", () => {
  const { root } = fixture();
  const result = run(root, { MODEL_DOWNLOAD_PARALLELISM: "17" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /parallelism must be between 1 and 16/i);
});

test("downloader preserves an incomplete partial so a later run can resume", () => {
  const expectedBytes = Buffer.byteLength("small fixture bytes, never model weights\n") + 10;
  const { root, contents } = fixture({ bytes: expectedBytes });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /incomplete download/i);
  const partial = readFileSync(join(root, "model", "fixture.gguf.partial"));
  assert.ok(partial.length > 0);
  assert.deepEqual(partial, contents.subarray(0, partial.length));
  assert.equal(existsSync(join(root, "model", "fixture.gguf")), false);
});

test("downloader rejects a wrong byte count without publishing a final file", () => {
  const { root } = fixture({ bytes: 1 });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sha-256 mismatch/i);
  assert.throws(() => readFileSync(join(root, "model", "fixture.gguf")));
});

test("downloader rejects a wrong hash without publishing a final file", () => {
  const { root } = fixture({ sha256: "0".repeat(64) });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sha-256 mismatch/i);
  assert.throws(() => readFileSync(join(root, "model", "fixture.gguf")));
  assert.ok(readdirSync(join(root, "model")).some((name) => name.startsWith("fixture.gguf.corrupt.")), "bad bytes remain recoverable for diagnosis");
});
