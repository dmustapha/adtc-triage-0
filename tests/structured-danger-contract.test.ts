import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const contractPath = "config/structured-danger-v1/contract.json";
const readContract = async () => JSON.parse(await readFile(contractPath, "utf8"));

test("structured age freezes the imported 2014 IMCI respiratory band", async () => {
  const contract = await readContract();
  const clinicalSources = JSON.parse(await readFile("config/clinical-sources.json", "utf8"));
  const source = clinicalSources.find(({ id }: { id: string }) => id === contract.patientAge.source.sourceId);
  const protocolReadme = await readFile(contract.patientAge.source.publicationMetadataPath, "utf8");
  const boundaryEvidence = await readFile(contract.patientAge.source.boundaryEvidencePath, "utf8");
  assert.deepEqual(contract.patientAge.units, ["months", "years"]);
  assert.equal(contract.patientAge.required, true);
  assert.equal(contract.patientAge.value.finite, true);
  assert.equal(contract.patientAge.value.minimumInclusive, 0);
  assert.deepEqual(contract.patientAge.supportedRespiratoryBandMonths, { minimumInclusive: 2, maximumExclusive: 60 });
  assert.equal(contract.patientAge.source.sourceId, "WHO-IMCI-RESP-2022");
  assert.equal(contract.patientAge.source.locator, "Cough or difficult breathing; general danger signs");
  assert.equal(source.url, contract.patientAge.source.url);
  assert.equal(source.locator, contract.patientAge.source.locator);
  assert.match(protocolReadme, /IMCI.*Chart Booklet, \*\*March 2014\*\*/);
  assert.deepEqual(contract.patientAge.source.boundaryEvidenceExactFragments, [
    "2 months up to 12 months",
    "12 months up to 3 years",
    "3 years up to 5 years"
  ]);
  for (const fragment of contract.patientAge.source.boundaryEvidenceExactFragments) assert.match(boundaryEvidence, new RegExp(fragment));
  assert.equal(contract.patientAge.source.sourceBytesPresent, false);
  assert.equal(contract.patientAge.source.clinicalReviewStatus, "pending");
  assert.equal(contract.patientAge.source.baselineCommit, "74424721bc75f564808eacce42d7f7f42676ae0f");
});

test("seven descriptive observations expose three request values and keep conflict internal", async () => {
  const contract = await readContract();
  const keys = ["cannotDrinkOrBreastfeed", "vomitsEverything", "convulsions", "lethargicOrUnconscious", "chestIndrawing", "stridorWhenCalm", "lowOxygenOrCentralCyanosis"];
  assert.deepEqual(contract.dangerObservations.keys, keys);
  assert.deepEqual(contract.dangerObservations.emergencyCapableKeys, keys.filter((key) => key !== "chestIndrawing"));
  assert.deepEqual(contract.dangerObservations.nonEmergencyClassificationKeys, ["chestIndrawing"]);
  assert.deepEqual(contract.dangerObservations.requestValues, ["PRESENT", "ABSENT", "NOT_ASSESSED"]);
  assert.deepEqual(contract.dangerObservations.internalValues, ["PRESENT", "ABSENT", "NOT_ASSESSED", "CONFLICT"]);
  assert.equal(contract.dangerObservations.missingFieldNormalizesTo, "NOT_ASSESSED");
  assert.equal(contract.dangerObservations.missingObjectNormalizesTo, "NOT_ASSESSED");
  assert.equal(contract.dangerObservations.requestAllowsConflict, false);
});

test("deterministic precedence protects emergencies and keeps chest indrawing non-emergency", async () => {
  const contract = await readContract();
  assert.deepEqual(contract.preModelPrecedence.map((branch: { id: string }) => branch.id), [
    "known-emergency-present",
    "assessment-incomplete-or-outside-scope",
    "isolated-chest-indrawing-supported-age",
    "supported-all-absent-qvac"
  ]);
  const [emergency, incomplete, chest, qvac] = contract.preModelPrecedence;
  assert.equal(emergency.beforeMissingAgeOrFields, true);
  assert.equal(emergency.modelInvoked, false);
  assert.equal(emergency.semanticRoutingInvoked, false);
  assert.deepEqual(incomplete.failClosedOn, ["MISSING_AGE", "UNSUPPORTED_AGE", "NOT_ASSESSED", "CONFLICT"]);
  assert.equal(incomplete.modelInvoked, false);
  assert.equal(chest.outcome, "NON_EMERGENCY_PNEUMONIA");
  assert.equal(chest.chestIndrawingAloneIsEmergency, false);
  assert.deepEqual(chest.ageBandMonths, { minimumInclusive: 2, maximumExclusive: 60 });
  assert.equal(qvac.runtime, "QVAC SDK 0.13.3");
  assert.equal(qvac.requiresAllSevenAbsent, true);
  assert.equal(qvac.modelInvoked, true);
});

test("one exact MedPsy artifact serves distinct product and raw-profiler evidence planes", async () => {
  const contract = await readContract();
  assert.deepEqual(contract.model, {
    candidateId: "medpsy-1.7b-q4",
    repository: "qvac/MedPsy-1.7B-GGUF",
    revision: "fd4cecc90c2de8dce4b112795456a54be9c59363",
    filename: "medpsy-1.7b-q4_k_m-imat.gguf",
    bytes: 1282439360,
    sha256: "41ee947d9cce72ec657577219fd1798fabeabf0d832217fe23c9d6d3d18d5880"
  });
  assert.equal(contract.evidencePlanes.product.name, "medpsy-product-v2");
  assert.equal(contract.evidencePlanes.product.runtime, "QVAC SDK 0.13.3");
  assert.equal(contract.evidencePlanes.rawProfiler.name, "medpsy-raw-profiler-v2");
  assert.equal(contract.evidencePlanes.rawProfiler.runtime, "pinned official llama.cpp");
  assert.equal(contract.evidencePlanes.rawProfiler.provesProductSafety, false);
  assert.equal(contract.evidencePlanes.historical.runId, 32742482642);
  assert.equal(contract.evidencePlanes.historical.immutable, true);
  assert.equal(contract.releaseBlockers.submitterIdentityPlaceholders, true);
});

test("requirements documents state the revised authority and evidence split", async () => {
  const [prd, architecture, observables] = await Promise.all(["PRD.md", "ARCHITECTURE.md", "FEATURE-OBSERVABLES.md"].map((path) => readFile(path, "utf8")));
  for (const document of [prd, architecture, observables]) {
    assert.match(document, /structured-danger-v1/);
    assert.match(document, /chest indrawing[^\n]*not[^\n]*emergency/i);
    assert.match(document, /medpsy-product-v2/);
    assert.match(document, /medpsy-raw-profiler-v2/);
  }
  assert.match(prd, /identity placeholders remain[^\n]*blocker/i);
  assert.match(architecture, /emergency[^\n]*before[^\n]*(semantic routing|MedPsy)/i);
  assert.match(observables, /card\.red_flags[^\n]*structured/i);
  assert.doesNotMatch(`${prd}\n${architecture}\n${observables}`, /raw one-pass extraction proves product safety/i);
});

async function historicalRunAggregate(): Promise<string> {
  const root = "evidence/medpsy-shared-runtime-v1/remote-run-32742482642";
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(root);
  const lines = await Promise.all(files.sort().map(async (path) => `${createHash("sha256").update(await readFile(path)).digest("hex")}  ${path}\n`));
  return createHash("sha256").update(lines.join("")).digest("hex");
}

test("historical run 32742482642 remains byte-immutable", async () => {
  assert.equal(await historicalRunAggregate(), "34a740958016b8fead9edbf16483dc41084b1619d891782756411d9ed962ca57");
});
