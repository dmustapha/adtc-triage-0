# Phase 5 Mock Leak Results

## Verdict

No synthetic runtime response, fake citation, cloud fallback, or user-visible speech/translation control was found. Narrow visible scope/runtime copy was corrected under TDD; diagnosis-first treatment-plan behavior remains a claim-bearing blocker.

## Clean boundaries

- `/tts` and `/transcribe` are not registered.
- Metadata language scope is exactly English.
- No tracked GGUF, partial model, QVAC cache, or node cache path was found.
- Historical run `32742482642` was not changed.
- No fake clinical response was generated to replace unavailable QVAC evidence.

## Stale imported surface

- Commit `0dafaa2` replaced the out-of-scope diarrhoea seed, `27 WHO classes`, and hardcoded `GPU` label with an in-scope respiratory example, schema-validation wording, and exact QVAC SDK 0.13.3 on-device identity.
- Dormant frontend strings and configuration still describe French/Spanish translation, speech, and TTS despite the English text baseline. They are not reachable through current controls or routes, but they increase maintenance and future claim-leak risk.
- Diagnosis-first classification, medicines, and management-plan rendering remain from the imported baseline and exceed the controlling PRD claim boundary.

```text
rg -n 'GPU|27 WHO classes|French|Spanish|multilingual|audio|translation' public/app.html public/assets/js/triage.js src/server.ts src/config.ts
# stale scope/runtime lines reviewed; narrow visible labels corrected in 0dafaa2

rg -n 'app\\.post\\("/(tts|transcribe)"' src/server.ts
# 0 matches
```

The rendered copy defects are real product-code defects, not evidence artifacts. They must be removed or the associated claims must remain absent.
