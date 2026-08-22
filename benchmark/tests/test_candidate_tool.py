import json
import tempfile
import unittest
from pathlib import Path

from benchmark.candidate_tool import candidate_by_id, prepare_stage


class CandidateToolTests(unittest.TestCase):
    def test_candidate_lookup_fails_closed(self):
        self.assertEqual(candidate_by_id("medpsy-1.7b-q4-k-m")["role"], "speed_baseline")
        with self.assertRaisesRegex(ValueError, "unknown candidate"):
            candidate_by_id("missing")

    def test_prepare_stage_writes_metadata_and_artifact_contract(self):
        candidate = candidate_by_id("medpsy-1.7b-q5-k-m")
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            prepare_stage(candidate, stage)
            metadata = json.loads((stage / "metadata.json").read_text())
            contract = json.loads((stage / "artifact-contract.json").read_text())

        self.assertEqual(metadata["model"]["quantization"], "GGUF Q5_K_M")
        self.assertEqual(contract["sha256"], candidate["sha256"])
        self.assertEqual(contract["url"], candidate["url"])


if __name__ == "__main__":
    unittest.main()
