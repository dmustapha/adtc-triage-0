import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def build_summary(artifact_root):
    candidates = []
    for directory in sorted(artifact_root.iterdir()):
        if directory.is_dir() and _is_complete(directory):
            candidates.append(_summarize_candidate(directory))
    candidates.sort(key=lambda row: row["scores"]["provisional_proxy_total"], reverse=True)
    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decision_status": "pending_qualitative_and_target_laptop_review",
        "thermal_evidence_valid": False,
        "methodology_note": (
            "This comparative proxy applies the published 50/30/20 weighting. "
            "It is not an official ADTC score and cannot replace physical-laptop "
            "thermal evidence or qualitative review of the two prompt responses."
        ),
        "candidates": candidates,
    }


def _is_complete(directory):
    required = ("artifact-contract.json", "profiler.json", "clinical.json")
    return all((directory / name).is_file() for name in required)


def _summarize_candidate(directory):
    contract = _load_json(directory / "artifact-contract.json")
    profiler = _load_json(directory / "profiler.json")
    clinical = _load_json(directory / "clinical.json")
    raw = _raw_metrics(profiler, clinical)
    scores = _score(raw)
    return {
        "id": contract["id"],
        "role": contract["role"],
        "license": contract["license"],
        "source_model_revision": contract.get("source_model_revision"),
        "training_lineage_note": contract.get("training_lineage_note"),
        "license_and_lineage_review": "pending",
        "metrics": raw,
        "scores": scores,
        "within_7gb_scoring_budget": raw["peak_rss_mb"] <= 7 * 1024,
        "qualitative_prompt_review": "pending",
    }


def _raw_metrics(profiler, clinical):
    accuracy = profiler.get("accuracy") or []
    if not accuracy:
        raise ValueError("profiler accuracy block is empty")
    return {
        "arc_easy": float(accuracy[0]["score"]),
        "clinical_weighted": float(clinical["holdout"]["weighted_accuracy"]),
        "generation_tps": float(profiler["throughput"]["tokens_per_second_generation"]),
        "peak_rss_mb": float(profiler["memory"]["peak_rss_mb"]),
    }


def _score(metrics):
    accuracy = 100 * (0.4 * metrics["arc_easy"] + 0.6 * metrics["clinical_weighted"])
    performance = min(metrics["generation_tps"] / 15.0, 1.0) * 100
    rss_gb = metrics["peak_rss_mb"] / 1024
    efficiency = max(0.0, (7.0 - rss_gb) / 7.0) * 100
    total = 0.5 * accuracy + 0.3 * performance + 0.2 * efficiency
    return {
        "accuracy_proxy": round(accuracy, 4),
        "performance": round(performance, 4),
        "efficiency": round(efficiency, 4),
        "provisional_proxy_total": round(total, 4),
    }


def _load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    summary = build_summary(args.artifacts)
    args.output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
