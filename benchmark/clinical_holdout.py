import json
import re
from pathlib import Path


def load_holdout(path=None):
    source = Path(path) if path else Path(__file__).with_name("clinical_holdout.json")
    return json.loads(source.read_text(encoding="utf-8"))


def extract_answer(text):
    normalized = text.strip().upper()
    final_content = normalized.rsplit("</THINK>", 1)[-1]
    patterns = (
        r"^\(?([ABCD])\)?[.\s]*$",
        r"^\(?([ABCD])\)?[.)]\s+",
        r"\bANSWER\s*(?:IS|:)?\s*\(?([ABCD])\)?\b",
        r"\b(?:CORRECT\s+)?CHOICE\s*(?:IS|:)?\s*\(?([ABCD])\)?\b",
    )
    for pattern in patterns:
        matches = re.findall(pattern, final_content)
        if matches:
            return matches[-1]
    return None


def score_responses(items, responses):
    details = [_score_item(item, responses.get(item["id"], "")) for item in items]
    weighted_total = sum(item["weight"] for item in items)
    weighted_correct = sum(row["weight"] for row in details if row["correct"])
    return {
        "correct": sum(row["correct"] for row in details),
        "total": len(items),
        "weighted_correct": weighted_correct,
        "weighted_total": weighted_total,
        "weighted_accuracy": weighted_correct / weighted_total if weighted_total else 0,
        "details": details,
    }


def _score_item(item, response):
    parsed = extract_answer(response)
    return {
        "id": item["id"],
        "category": item.get("category"),
        "expected": item["answer"],
        "parsed": parsed,
        "correct": parsed == item["answer"],
        "weight": item["weight"],
        "response": response,
    }
