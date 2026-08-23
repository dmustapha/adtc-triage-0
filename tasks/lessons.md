# Lessons

User corrections and durable lessons:

- Competitor intelligence must be explicit and deep for every new Devpost pipeline: named projects, comparable baselines, evidence tiers, track saturation, and a kill list. Reuse the strongest recent hackathon research pattern rather than relying on generic market analysis.
- Do not phrase the no-training path as the only path. It is the guaranteed fallback. We can still use local CPU testing, external x86 runners, and optional GPU compute if evidence shows fine-tuning is worth the schedule risk.
- When the user surfaces an existing project during ideation, pause idea selection and run a requirement-level candidate audit first. Reuse is only advantageous if the scored model artifact, license, runtime, and evaluator contract survive scrutiny.
- Do not reduce a hackathon's required technology to a compliance-only evaluator boundary. First identify every organizer-owned technology surface, then make the required stack load-bearing in architecture, benchmarking, developer workflow, and proof while keeping unrelated prior technology subordinate.
- A component-level migration recommendation must trace every feature to code, evaluator visibility, provenance, resource cost, safety risk, target implementation, and acceptance evidence. High-level “keep QVAC, add llama.cpp” language is insufficient for an architecture decision.
- A working prior application creates a zero-loss parity obligation when adapting it: every visible and invisible feature needs an explicit disposition, dependency plan, acceptance test, evidence artifact, and fallback. Submission compliance alone is not product completeness.
- Never recommend a hosted frontend by habit for an offline-model hackathon. First distinguish the canonical local product from an optional presentation mirror, then verify whether hosting is required or merely distracting.
## 2026-08-22: Distinguish cloud credentials from compute resources

- A downloaded Lightsail default key proves SSH-key availability only. It does not prove that an instance exists.
- Verify instance inventory independently before proposing connection or benchmark steps.
- Creating new cloud compute is billable external state and requires explicit user approval, even when credentials or keys already exist locally.
## 2026-08-22: Cross-check semantic fields across organizer surfaces

Do not infer the meaning of `african_alpha_claim` from the template field description alone. The template describes an African Use Case Bonus, while the current organizer FAQ defines African Alpha through meaningful African-language functionality. Preserve the conflict explicitly and choose the conservative value until written clarification or validated language support closes it.

## 2026-08-22: Separate deployment infrastructure from evidence infrastructure

- A local-first application does not need public hosting, but remote x86 compute can still be useful for compatibility, profiling, and soak tests.
- Once a controlled GitHub Actions run succeeds, a paid persistent VPS is optional unless interactive Linux debugging, cached repeat runs, or longer soak tests justify it.
- Neither a VPS nor a hosted runner can replace physical target-laptop thermal, throttling, and full-product proof.

## 2026-08-22: Preserve the scope-to-forge boundary

- A request for the plan to close a scoped deficit does not authorize forge or implementation planning when the user has explicitly kept the project in scoping.
- During scoping, define capabilities, priorities, dependencies, tradeoffs, deficits, and acceptance gates without creating worktrees, exact build tasks, code scaffolds, or commits.
- Exact files, TDD steps, implementation sequencing, and executable work packages begin only after forge is explicitly entered.

## 2026-08-23: Explicit naming choices supersede generated shortlists

- When the user supplies the final project name during a naming checkpoint, stop candidate generation and record that choice directly.
- A sequential name such as `Triage-01` makes prior-project lineage visible, so public materials must distinguish conceptual continuity from implementation reuse with unusually explicit provenance language.

## 2026-08-23: Bound Forge audits by claim surface, not document expansion

- A Forge quality audit must converge on the smallest implementable evidence contract; repeated failures must not cause unbounded Architecture growth.
- After the first material semantic failure, classify findings as required P0 proof, safely unavailable external proof, or deferred Build-time evidence. Do not keep specifying hypothetical machinery for unavailable organizer-controlled trust.
- When the user authorizes a final repair, freeze scope to named defects, prohibit new files/components/claims, run one targeted verification, and finish Forge immediately if those acceptance checks pass.

## 2026-08-23: Stop reviewing once architecture risk becomes evidence-gate risk

- When structure, PRD alignment, type extraction, and runnable tests are green, residual release-evidence automation gaps do not justify more Architecture review loops.
- Freeze the design, label unavailable external trust honestly, and convert remaining proof gaps into named Build/release acceptance gates.
- “No more reviews” means no more Forge Architecture audit iterations. Preserve the separately requested conductor Critique phase unless the user explicitly cancels Critique.

## 2026-08-23: Distinguish repeated Forge audits from the pipeline Critique

- Do not interpret a request to stop repeated Architecture audits as cancellation of the explicitly requested Critique phase.
- Critique should run once, deeply and independently, consolidate errors and dispositions, and then terminate without another review loop.
- Optimize for time-to-Build: Forge freezes the blueprint; Critique identifies risks; URL Preverification checks public proof surfaces; implementation fixes belong to Build.

## 2026-08-23: One-shot termination must preserve the model chat template

- In pinned llama.cpp, `-no-cnv` disables conversation mode and therefore bypasses embedded chat-template application; it is not a valid fix for a templated instruct-model hang.
- For a one-turn instruct evaluation, follow the pinned runtime's documented combination: `--jinja --single-turn -p`.
- If a producer invocation changes before any valid raw rows exist, withdraw the invalid behavioral verdict, freeze the corrected producer hash, and rerun the unchanged corpus rather than tuning against outputs.

## 2026-08-23: A negative finalist result needs an executable fallback

- A fail-closed model gate is valuable, but it must immediately produce a ranked, constraint-compatible recovery candidate rather than leaving the user with only `selectedCandidateId: null`.
- Separate a verified rejection from completion of the practical objective. The evaluation can be correct while the model-selection task remains unfinished.
- When the user requires a decision under deadline, lock one exact artifact, one bounded attempt, and one terminal fallback instead of reopening an unbounded candidate search.
