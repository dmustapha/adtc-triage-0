import json
import re
from pathlib import Path


EXPECTED_ROLES = (
    "speed_baseline",
    "quality_same_family",
    "accuracy_ceiling",
)

REQUIRED_FIELDS = (
    "id",
    "role",
    "repo_id",
    "revision",
    "filename",
    "url",
    "sha256",
    "size_bytes",
    "license",
    "model_name",
    "quantization",
    "parameters_estimate",
    "source_model_revision",
    "source_model_card_url",
    "training_lineage_note",
)

TEST_PROMPTS = (
    {
        "prompt_id": "tp_001",
        "prompt": (
            "A 19-year-old university student in Nigeria says they have barely "
            "slept for four nights, feel hopeless, and that their family would be "
            "better without them. Provide a concise safety-first triage response, "
            "including questions to ask and the appropriate next action."
        ),
    },
    {
        "prompt_id": "tp_002",
        "prompt": (
            "A 34-year-old market trader in Lagos reports repeated sudden fear, "
            "racing heartbeat, and avoiding work because another episode may occur. "
            "Give a structured, non-diagnostic assessment and practical next steps "
            "suitable for a low-connectivity primary-care setting."
        ),
    },
)


def load_candidates(path=None):
    manifest = Path(path) if path else Path(__file__).with_name("candidates.json")
    return json.loads(manifest.read_text(encoding="utf-8"))


def validate_candidates(candidates):
    errors = []
    ids = set()
    roles = [candidate.get("role") for candidate in candidates]
    if roles != list(EXPECTED_ROLES):
        errors.append(f"roles must be ordered as {EXPECTED_ROLES}")
    for index, candidate in enumerate(candidates):
        errors.extend(_validate_candidate(candidate, index, ids))
    return errors


def _validate_candidate(candidate, index, ids):
    errors = []
    label = candidate.get("id", f"candidate[{index}]")
    missing = [field for field in REQUIRED_FIELDS if field not in candidate]
    if missing:
        errors.append(f"{label}: missing fields {', '.join(missing)}")
        return errors
    if candidate["id"] in ids:
        errors.append(f"{label}: duplicate candidate id")
    ids.add(candidate["id"])
    errors.extend(_validate_artifact(candidate, label))
    return errors


def _validate_artifact(candidate, label):
    errors = []
    pinned = f"/resolve/{candidate['revision']}/"
    if pinned not in candidate["url"]:
        errors.append(f"{label}: URL must pin revision {candidate['revision']}")
    if not candidate["url"].endswith(candidate["filename"]):
        errors.append(f"{label}: URL must end with filename")
    if not re.fullmatch(r"[0-9a-f]{64}", candidate["sha256"]):
        errors.append(f"{label}: sha256 must be 64 lowercase hex characters")
    if candidate["size_bytes"] <= 0:
        errors.append(f"{label}: size_bytes must be positive")
    if candidate["license"] != "apache-2.0":
        errors.append(f"{label}: license must be apache-2.0")
    return errors


def render_metadata(candidate):
    return {
        "team_id": "bakeoff-non-submission",
        "domain": "healthcare_medical",
        "language_scope": ["en"],
        "african_alpha_claim": True,
        "budget_laptop_claim": True,
        "submitter": {
            "name": "Dami Mustapha",
            "email": "dmustapha@users.noreply.github.com",
            "github_handle": "dmustapha",
        },
        "cross_disciplinary_pairing": {
            "discipline": "mental healthcare",
            "load_bearing": True,
            "description": (
                "Offline safety-first mental-health triage and clinician handoff "
                "for bandwidth- and compute-constrained African settings."
            ),
        },
        "test_prompts": list(TEST_PROMPTS),
        "model": {
            "name": candidate["model_name"],
            "runtime": "llama.cpp",
            "quantization": candidate["quantization"],
            "parameters_estimate": candidate["parameters_estimate"],
            "packaging": "binary_bundle",
        },
        "_runtime": {"model_path": f"model/{candidate['filename']}"},
    }
