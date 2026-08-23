import argparse
import json
from pathlib import Path

from benchmark.candidate_contract import load_candidates, render_metadata


def candidate_by_id(candidate_id):
    for candidate in load_candidates():
        if candidate["id"] == candidate_id:
            return candidate
    raise ValueError(f"unknown candidate: {candidate_id}")


def prepare_stage(candidate, stage):
    stage.mkdir(parents=True, exist_ok=True)
    (stage / "model").mkdir(exist_ok=True)
    _write_json(stage / "metadata.json", render_metadata(candidate))
    _write_json(stage / "artifact-contract.json", candidate)


def _write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main():
    parser = _build_parser()
    args = parser.parse_args()
    try:
        _run_command(args)
    except ValueError as error:
        parser.error(str(error))


def _build_parser():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    get = commands.add_parser("get")
    get.add_argument("candidate_id")
    get.add_argument("field")
    prepare = commands.add_parser("prepare")
    prepare.add_argument("candidate_id")
    prepare.add_argument("stage", type=Path)
    commands.add_parser("ids")
    return parser


def _run_command(args):
    if args.command == "ids":
        print("\n".join(candidate["id"] for candidate in load_candidates()))
        return
    candidate = candidate_by_id(args.candidate_id)
    if args.command == "prepare":
        prepare_stage(candidate, args.stage)
        return
    if args.field not in candidate:
        raise ValueError(f"unknown field: {args.field}")
    print(candidate[args.field])


if __name__ == "__main__":
    main()
