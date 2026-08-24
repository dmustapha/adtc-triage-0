# Phase 5 Frontend Results

## Verdict

Claim-limited local UI: PASS WITH FINDINGS. Claim-bearing release: BLOCKED.

## Verified

- The patient age plus seven-observation checklist is accessible, tri-state, fail-closed, and hidden behind progressive disclosure.
- Unsupported speech and translation controls are absent from the rendered page.
- Model-authored `red_flags` are not rendered.
- Dynamic citation, card, plan, stage, and error content uses text assignment or `esc()` before HTML insertion.
- Focused frontend/SSE run: 20 total, 17 pass, 0 fail, 3 store-dependent skips.

## Proven defects

- The page originally asserted `This ran on the device. No network was used.` before any run. The local store is empty and no model is resident, so this was a false completed-run claim.
- The browser reachability badge originally rendered bare `Online`, creating an apparent contradiction with the no-egress claim.
- The controlling PRD supports pediatric respiratory review, but the example seed described watery diarrhoea. Commit `0dafaa2` replaces it with an in-scope cough/difficult-breathing case.
- The UI and server used user-visible broad-scope labels for `27 WHO classes` and a hardcoded `GPU` backend. Commit `0dafaa2` replaces them with schema-validation and exact QVAC SDK 0.13.3 on-device wording.
- Existing card markup is explicitly diagnosis-first and can show medicines and management-plan language, while the controlling PRD says the prototype does not diagnose, prescribe, or determine treatment. This is a claim-bearing release blocker even though the local safety tests pass.

Commit `8d7b767` fixes the two pre-run copy defects under focused TDD. Commit `0dafaa2` fixes the narrow scope/runtime labels. Diagnosis-first treatment-plan behavior remains outside this sub-audit's allowed Build-test boundary and is a documented claim-bearing blocker.

## Commands

```text
node --import tsx --test tests/integration/sse-contract.test.ts tests/unit/frontend.test.ts
# 20 total, 17 pass, 0 fail, 3 skipped

node --import tsx --test tests/debug-scope-claims.test.ts tests/debug-ui-claims.test.ts tests/unit/frontend.test.ts tests/integration/sse-contract.test.ts
# 25 total, 22 pass, 0 fail, 3 store-dependent skips

rg -n 'innerHTML\\s*=|insertAdjacentHTML|outerHTML|document\\.write|eval\\(|new Function' public/assets/js
# 11 dynamic sink lines, all reviewed

rg -n 'esc\\(' public/assets/js/triage.js
# 23 escape-call lines
```

No browser screenshot was generated in this sub-audit because the supported model/store prerequisites are absent and the user prohibited a misleading partial preview.
