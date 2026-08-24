# Autonomous pipeline authority through Interrogate

**Saved:** 2026-08-24
**Working directory:** `/Users/MAC/adtc-2026`
**Stop boundary:** Before `demo_rehearsal`

## User directive

The user is leaving for work and expects the conductor to finish Build and every applicable downstream skill through Interrogate, then stop before Demo Rehearsal. The user authorizes the agent to iterate and make correct decisions for unresolved gates without waiting for routine check-ins.

## Bounded interpretation

Proceed autonomously through reversible in-scope work:

- Build;
- Debug;
- Wire;
- Verify Milestone;
- Design Forge or a truthful conductor-supported skip if inapplicable;
- Stress Test;
- Polish auto-skip;
- Deploy to the already established public GitHub submission surface;
- Livetest;
- Interrogate in DEEP mode.

Stop before dispatching Demo Rehearsal.

The directive authorizes reviewed publication commits to the existing verified public repository when Deploy is reached. It does not authorize:

- fabricated human clinical review;
- fabricated physical target-hardware evidence;
- unsupported rights, language, platform, thermal, or clinical claims;
- Devpost final submission;
- final video publication;
- spending;
- destructive actions;
- model search, fine-tuning, or a replacement candidate;
- weakening a failed mandatory official artifact gate.

## Autonomous gate policy

For every unresolved gate, the conductor or owning skill must choose one truthful outcome:

1. `done`: real evidence satisfies it;
2. `waived-with-reason`: the gate is an internal conservative requirement, not an official rule, and the protected claim/feature is removed or narrowed;
3. `blocked`: the missing evidence is mandatory for the official artifact or requested phase and no truthful fallback exists.

Allowed autonomous responses:

- retry deterministic technical failures within the frozen budget;
- fix implementation defects under TDD;
- exclude unreviewed clinical sources and fail closed;
- narrow the product to English;
- disclose the proven product platform if QVAC Ubuntu x86 fails;
- label GitHub Actions x86 and Apple evidence accurately;
- omit thermal or target-hardware claims when physical evidence is unavailable;
- describe the product as an unvalidated supervised early-PoC when no named clinician is available;
- cut STT, TTS, translation, UI redesign, and other optional features;
- stop rather than sign a false model decision.

Not allowed:

- marking an absent human reviewer as passed;
- promoting CI or Apple measurements to physical Ubuntu evidence;
- asserting full data rights certainty;
- signing a model decision that contradicts its evidence;
- advancing past an official GGUF, llama.cpp, profiler, OOM/crash, public-artifact, or reproducibility failure.

## Current Build status

- Legal/provenance implementation and independent review passed.
- Exact legal/provenance commit: `680d06d feat: freeze Triage-0 import provenance`.
- PULSE checkpoint commit: `c99c13d`.
- Final legal gate evidence: 7/7 focused tests, 42/42 full tests, typecheck clean, 76 exact Git objects verified, no weight retained.
- Task 3 exact pinned application import is dispatched under TDD.
- No current Task 3 blocker was reported at this checkpoint.

## Required stop condition

After Interrogate completes or blocks, save state, update the conductor beacon and PULSE, release or preserve the conductor lock according to protocol, and report the exact remaining blockers. Do not dispatch Demo Rehearsal.
