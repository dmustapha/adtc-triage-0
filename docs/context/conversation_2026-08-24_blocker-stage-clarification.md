# Shared-MedPsy blocker-stage clarification

**Saved:** 2026-08-24
**Working directory:** `/Users/MAC/adtc-2026`

## User question

The user asked whether human clinical review, source-rights review, physical Ubuntu evidence, QVAC x86 verification, and publication are decisions the agent can make during Build, or exact blockers that prevent the whole Build.

## Controlling clarification

Build is already running. These are staged gates, not universal Build-start blockers.

| Gate | Can Build continue before it? | What it actually blocks |
|---|---|---|
| Legal/provenance manifest | No import before pass | Triage-0 application import |
| Source-rights review | Yes, with unreviewed sources fail-closed or excluded | Claims/actions relying on unreviewed clinical sources and final source approval |
| Human clinical review | Yes | Truthful final model decision, strong clinical claims, and Phase 2 transition |
| Physical Ubuntu evidence | Yes | Final hardware, thermal, throttling, Ubuntu product, and official-equivalent claims; signed model decision under the approved gate |
| QVAC x86 verification | Yes | Ubuntu x86 product-runtime claim; failure narrows the product platform rather than invalidating direct llama.cpp profiling |
| Publication | Yes | Public URL verification, Deploy/Livetest completion, video hosting, and Devpost submission |

The agent may implement, test, prepare evidence producers, narrow unsupported claims, and choose reversible fail-closed defaults. It may not impersonate a human clinician, fabricate physical measurements, assert unproven rights/platform support, publish to an unverified target, spend, or submit Devpost without the applicable gate.

If a later gate fails, the normal response is to narrow the claim, exclude the affected optional feature/source, or stop the protected transition. It does not automatically erase the completed application Build. The only whole-pipeline failures are failures of the mandatory official artifact itself, such as inaccessible/wrong GGUF, direct llama.cpp incompatibility, OOM/crash, inability to produce truthful required profiler evidence, or inability to deliver the required public submission package.
