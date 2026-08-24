import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJsonStdout } from "../scripts/medpsy-shared-runtime-v2/json-framing.js";

test("exports the exact-one-JSON stdout normalizer", async () => {
  const framing = await import("../scripts/medpsy-shared-runtime-v2/json-framing.js");

  assert.equal(typeof framing.normalizeJsonStdout, "function");
});

test("removes surrounding whitespace while preserving raw stdout", () => {
  const rawStdout = " \n {\"ok\":true}\t ";
  assert.deepEqual(normalizeJsonStdout(rawStdout), {
    rawStdout,
    normalizedPayload: "{\"ok\":true}",
    framing: {
      leadingWhitespace: " \n ",
      beforeTerminalWhitespace: "",
      terminalMarker: null,
      trailingWhitespace: "\t ",
    },
  });
});

test("accepts the documented terminal llama.cpp marker", () => {
  const rawStdout = "{\"ok\":true}\n[end of text]\r\n";
  assert.deepEqual(normalizeJsonStdout(rawStdout), {
    rawStdout,
    normalizedPayload: "{\"ok\":true}",
    framing: {
      leadingWhitespace: "",
      beforeTerminalWhitespace: "\n",
      terminalMarker: "[end of text]",
      trailingWhitespace: "\r\n",
    },
  });
});

test("ignores braces and brackets inside JSON strings", () => {
  const rawStdout = "{\"text\":\"literal } and ] remain text\",\"nested\":{\"ok\":true}}";
  assert.equal(normalizeJsonStdout(rawStdout).normalizedPayload, rawStdout);
});

test("tracks escaped quotes and backslashes inside strings", () => {
  const expected = {
    text: 'quoted "}" and slash \\',
    ok: true,
  };
  const rawStdout = JSON.stringify(expected);
  assert.deepEqual(JSON.parse(normalizeJsonStdout(rawStdout).normalizedPayload), expected);
});

test("accepts one nested array or one nested object", () => {
  for (const rawStdout of ["[1,{\"items\":[2,3]}]", "{\"items\":[1,{\"n\":2}]}"]) {
    assert.equal(normalizeJsonStdout(rawStdout).normalizedPayload, rawStdout);
  }
});

test("rejects any non-whitespace prefix", () => {
  assert.throws(() => normalizeJsonStdout("assistant: {\"ok\":true}"), /prefix/i);
});

test("rejects any undocumented suffix", () => {
  assert.throws(() => normalizeJsonStdout("{\"ok\":true} trailing"), /suffix/i);
});

test("rejects multiple JSON values", () => {
  for (const rawStdout of ["{} []", "{}\n{}\n[end of text]"]) {
    assert.throws(() => normalizeJsonStdout(rawStdout), /multiple|suffix/i);
  }
});

test("rejects truncated objects and arrays", () => {
  for (const rawStdout of ["{\"nested\":[1,2]", "[1,{\"ok\":true}"]) {
    assert.throws(() => normalizeJsonStdout(rawStdout), /truncated/i);
  }
});

test("rejects non-JSON stdout", () => {
  for (const rawStdout of ["", "not JSON", "[end of text]"]) {
    assert.throws(() => normalizeJsonStdout(rawStdout), /JSON/i);
  }
});

test("rejects mutated terminal markers", () => {
  for (const marker of ["[end of text", "[END OF TEXT]", "[end of text] extra"]) {
    assert.throws(() => normalizeJsonStdout(`{\"ok\":true}\n${marker}`), /suffix|multiple/i);
  }
});
