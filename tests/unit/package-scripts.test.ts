import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("every advertised local package script targets an existing entrypoint", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  for (const [name, command] of Object.entries(pkg.scripts)) {
    const targets = command.split(/\s+/).filter((token) => /^(?:scripts|src|tests)\//.test(token) && !token.includes("*"));
    for (const target of targets) assert.equal(existsSync(target), true, `${name} targets missing ${target}`);
  }
});
