import argparse
import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

from benchmark.candidate_contract import TEST_PROMPTS
from benchmark.clinical_holdout import load_holdout, score_responses


MCQ_SYSTEM = (
    "Select the single safest and most clinically appropriate option. "
    "Return only 'Answer: X', where X is A, B, C, or D."
)
RESPONSE_SYSTEM = (
    "You are an offline mental-health triage assistant for resource-constrained "
    "African settings. Be safety-first, concise, non-diagnostic, explicit about "
    "uncertainty, and escalate emergencies to available local human care."
)


def build_mcq_prompt(item):
    choices = "\n".join(f"{key}. {value}" for key, value in item["options"].items())
    return f"{item['question']}\n\n{choices}"


def generate(llm, prompt, system, max_tokens):
    started = time.perf_counter()
    result = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=max_tokens,
    )
    content = result["choices"][0]["message"]["content"].strip()
    return content, round(time.perf_counter() - started, 4)


def run_suite(llm, holdout, participant_prompts):
    raw_answers = {}
    timings = {}
    for item in holdout:
        raw_answers[item["id"]], timings[item["id"]] = generate(
            llm, build_mcq_prompt(item), MCQ_SYSTEM, 16
        )
    report = score_responses(holdout, raw_answers)
    _attach_timings(report, timings)
    return {
        "holdout": report,
        "participant_prompts": _run_participant_prompts(llm, participant_prompts),
    }


def _attach_timings(report, timings):
    for row in report["details"]:
        row["elapsed_seconds"] = timings[row["id"]]


def _run_participant_prompts(llm, prompts):
    outputs = []
    for item in prompts:
        response, elapsed = generate(llm, item["prompt"], RESPONSE_SYSTEM, 384)
        outputs.append({**item, "response": response, "elapsed_seconds": elapsed})
    return outputs


def load_model(model_path):
    from llama_cpp import Llama

    return Llama(
        model_path=str(model_path),
        n_ctx=2048,
        n_threads=4,
        n_gpu_layers=0,
        seed=42,
        verbose=False,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = run_suite(load_model(args.model), load_holdout(), list(TEST_PROMPTS))
    result["provenance"] = _provenance(args.model)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


def _provenance(model_path):
    return {
        "model_path": str(model_path),
        "seed": 42,
        "n_ctx": 2048,
        "n_threads": 4,
        "n_gpu_layers": 0,
        "platform": platform.platform(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    main()
