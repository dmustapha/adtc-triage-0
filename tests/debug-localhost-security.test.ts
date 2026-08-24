import { readFileSync } from "node:fs";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

import { app } from "../src/server.js";

test("debug: production server binds only to IPv4 loopback", () => {
  const source = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  assert.match(source, /app\.listen\(port,\s*["']127\.0\.0\.1["']/);
});

test("debug: browser responses deny framing and inline script execution", async () => {
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const csp = response.headers.get("content-security-policy") ?? "";

    assert.match(csp, /script-src 'self'(?:;|$)/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
