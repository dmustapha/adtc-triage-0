import json
import tempfile
import unittest
from pathlib import Path

from benchmark.candidate_contract import (
    EXPECTED_ROLES,
    load_candidates,
    render_metadata,
    validate_candidates,
)


class CandidateContractTests(unittest.TestCase):
    def setUp(self):
        self.candidates = load_candidates()

    def test_manifest_contains_the_three_ordered_bakeoff_roles(self):
        self.assertEqual(
            [candidate["role"] for candidate in self.candidates],
            list(EXPECTED_ROLES),
        )

    def test_each_candidate_has_a_pinned_public_artifact_contract(self):
        errors = validate_candidates(self.candidates)
        self.assertEqual(errors, [])

        for candidate in self.candidates:
            self.assertRegex(candidate["sha256"], r"^[0-9a-f]{64}$")
            self.assertGreater(candidate["size_bytes"], 1_000_000_000)
            self.assertEqual(candidate["license"], "apache-2.0")
            self.assertIn("CC-BY-NC 4.0", candidate["training_lineage_note"])
            self.assertRegex(candidate["source_model_revision"], r"^[0-9a-f]{40}$")
            self.assertIn(f"/resolve/{candidate['revision']}/", candidate["url"])
            self.assertTrue(candidate["url"].endswith(candidate["filename"]))

    def test_duplicate_ids_and_unpinned_urls_are_rejected(self):
        duplicate = json.loads(json.dumps(self.candidates))
        duplicate[1]["id"] = duplicate[0]["id"]
        duplicate[1]["url"] = duplicate[1]["url"].replace(
            f"/resolve/{duplicate[1]['revision']}/", "/resolve/main/"
        )

        errors = validate_candidates(duplicate)

        self.assertTrue(any("duplicate candidate id" in error for error in errors))
        self.assertTrue(any("must pin revision" in error for error in errors))

    def test_metadata_uses_candidate_identity_and_exact_model_path(self):
        candidate = self.candidates[0]
        metadata = render_metadata(candidate)

        self.assertEqual(metadata["domain"], "healthcare_medical")
        self.assertEqual(metadata["model"]["runtime"], "llama.cpp")
        self.assertEqual(metadata["model"]["quantization"], candidate["quantization"])
        self.assertEqual(
            metadata["_runtime"]["model_path"],
            f"model/{candidate['filename']}",
        )
        self.assertEqual(len(metadata["test_prompts"]), 2)

    def test_metadata_can_be_serialized_without_placeholders(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "metadata.json"
            target.write_text(json.dumps(render_metadata(self.candidates[0])))
            encoded = target.read_text()

        self.assertNotIn("your-team-id", encoded)
        self.assertNotIn("coding_assistants", encoded)
        self.assertNotIn("SmolLM2", encoded)


if __name__ == "__main__":
    unittest.main()
