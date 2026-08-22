# ADTC 2026 Competitor Intelligence Specification

This is a mandatory input to the `hackathon-intel` phase. It adapts the strongest recent research pattern from `agents-onchain`, `wtf-hackathon`, and `base44-dev-build-off` to a Devpost model competition.

## Required opening

The Competitor Landscape section starts with four explicit calls:

- **BOTTOM LINE:** How crowded is the field and where is the strongest threat?
- **EVIDENCE:** What was enumerated and audited, with counts?
- **CONFIDENCE:** Which conclusions are high, medium, or low confidence?
- **SO WHAT:** What must warroom avoid or exploit?

## Evidence classes

Never collapse these into one competitor count:

1. **Formal current submission:** Published in the ADTC Devpost gallery.
2. **Explicit current-event repository:** README, topics, metadata, or commits explicitly name ADTC 2026.
3. **Registered participant:** Listed on Devpost, with no public project proof yet.
4. **Template fork:** Fork of the official repository. Intent signal only until material commits exist.
5. **Timing candidate:** Relevant repository created or materially updated during the event window, but no explicit ADTC marker.
6. **Adjacent model:** Public GGUF or model submission targeting the same hardware, language, or domain.
7. **Prior art:** Earlier ADTC winner or similar constrained-compute competition entry.

## Audit funnel

Record counts at every stage:

`Devpost participants -> resolvable profiles -> GitHub handles -> public repos -> ADTC-tagged repos -> materially changed forks -> formal submissions`

For the official template, distinguish:

`all forks -> forks ahead of upstream -> forks with placeholders removed -> forks with public GGUF URL -> forks with profiler JSON -> reproducible high-threat entries`

Save the raw and derived data under `research/competitor-audit/`. At minimum:

- `devpost-participants.json`
- `template-forks.json`
- `github-repository-audit.json`
- `explicit-current-projects.json`
- `competitor-registry.json`
- `density-by-domain.json`
- `density-by-model-strategy.json`

## Competitor registry

| Field | Requirement |
|---|---|
| Project and entrant | Named, linked, and attributable |
| Evidence class | One of the seven classes above |
| Domain | One official ADTC domain or unknown |
| Threat | HIGH, MEDIUM, or LOW with one-line reason |
| Model | Base family, parameter band, and exact GGUF if published |
| Optimization | Quantization, context, thread count, training, distillation, or prompt strategy |
| Localization | Languages, local datasets, and African-use-case evidence |
| Cross-disciplinary pairing | What is load-bearing, if anything |
| Proof | Profiler JSON, raw metrics, demo, report, or only claims |
| Freshness | Last meaningful commit and event-window relevance |
| Source quality | Admiralty tag plus confidence |

## Density maps

Produce both:

1. **Domain density:** math/science, healthcare, agriculture, creative writing, coding, enterprise, autonomous agents.
2. **Strategy density:** parameter band, model family, quantization, African language, local RAG, fine-tuned versus baseline, and application pairing.

The opportunity is a cell that is low-density, technically feasible before the deadline, scoreable on hidden prompts, and defensible as an African use case.

## Threat analysis

For every HIGH threat, state:

- What it already proves
- What it only claims
- Its likely scoring advantage
- Its likely failure mode
- The categorical advantage needed to beat it

Do not settle for a feature-level variation of a high-threat entry.

## Required kill list

End competitor intelligence with:

1. **Saturated:** Overcrowded domain and model combinations.
2. **Broken Dependencies:** Gated weights, unclear licenses, cloud-only components, unavailable datasets, or GPU plans that cannot finish.
3. **Already Built:** Direct clones of public current entries, prior winners, or strong adjacent baselines.
4. **Zero Alignment:** UI-first products, non-GGUF runtimes, online inference, or pairings that judges do not evaluate.

## Quality gate

- At least 10 named competitors or adjacent models.
- At least 20 searches across Devpost, GitHub, Hugging Face, model leaderboards, prior constrained-compute events, and organizer sources.
- Direct source link for every HIGH threat.
- Reproducible counts backed by saved artifacts.
- Clear blind-spot statement for unpublished Devpost projects.
- No fork, participant, or timing candidate misrepresented as a submitted project.
