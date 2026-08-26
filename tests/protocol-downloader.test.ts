import assert from "node:assert/strict";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "adtc-protocols-"));
  const bin = join(root, "bin");
  const bytes = Buffer.from("locked WHO fixture\n");
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(bin);
  cpSync("download_protocols.sh", join(root, "download_protocols.sh"));
  writeFileSync(join(root, "config", "canonical-protocols.json"), JSON.stringify({
    schemaVersion: 1,
    protocols: ["one", "two"].map((id) => ({
      id, url: `https://cdn.who.int/${id}.pdf`, path: `data/protocols/${id}.pdf`,
      bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  }));
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env bash\nset -e\nout=''\nwhile (($#)); do [[ "$1" == '--output' ]] && { out="$2"; shift 2; continue; }; shift; done\nprintf 'locked WHO fixture\\n' > "$out"\n`);
  chmodSync(join(bin, "curl"), 0o755);
  return { root, bin, bytes };
}

function run(root: string, bin: string) {
  return spawnSync("bash", [join(root, "download_protocols.sh")], {
    cwd: root, encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
}

test("protocol downloader installs two checksum-locked WHO files and is idempotent", () => {
  const { root, bin, bytes } = fixture();
  assert.equal(run(root, bin).status, 0);
  assert.deepEqual(readFileSync(join(root, "data/protocols/one.pdf")), bytes);
  chmodSync(join(bin, "curl"), 0o000);
  const second = run(root, bin);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already present and verified/g);
});

test("protocol downloader fails closed without replacing wrong existing bytes", () => {
  const { root, bin } = fixture();
  mkdirSync(join(root, "data/protocols"), { recursive: true });
  writeFileSync(join(root, "data/protocols/one.pdf"), "wrong");
  const result = run(root, bin);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(root, "data/protocols/one.pdf"), "utf8"), "wrong");
  assert.match(result.stderr, /existing protocol failed verification/);
});
