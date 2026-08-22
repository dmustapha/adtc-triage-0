import json
import tempfile
import unittest
from pathlib import Path

from benchmark.summarize import build_summary


def write_candidate(root, candidate_id, arc, clinical, tps, rss):
    directory = root / candidate_id
    directory.mkdir()
    (directory / "artifact-contract.json").write_text(
        json.dumps(
            {
                "id": candidate_id,
                "role": "test",
                "license": "apache-2.0",
                "source_model_revision": "0" * 40,
                "training_lineage_note": "review required",
            }
        )
    )
    (directory / "profiler.json").write_text(
        json.dumps(
            {
                "accuracy": [{"benchmark": "arc_easy", "score": arc}],
                "throughput": {"tokens_per_second_generation": tps},
                "memory": {"peak_rss_mb": rss},
                "cpu_thermal": {"core_temp_c_peak": None, "throttled": False},
            }
        )
    )
    (directory / "clinical.json").write_text(
        json.dumps({"holdout": {"weighted_accuracy": clinical}})
    )


class SummarizeTests(unittest.TestCase):
    def test_summary_uses_published_weighting_and_ranks_descending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_candidate(root, "small", 0.6, 0.7, 15.0, 2048)
            write_candidate(root, "large", 0.8, 0.9, 8.0, 4096)
            summary = build_summary(root)

        self.assertEqual(len(summary["candidates"]), 2)
        self.assertEqual(summary["candidates"][0]["id"], "small")
        small = next(row for row in summary["candidates"] if row["id"] == "small")
        self.assertAlmostEqual(small["scores"]["accuracy_proxy"], 66.0)
        self.assertAlmostEqual(small["scores"]["performance"], 100.0)
        self.assertAlmostEqual(small["scores"]["efficiency"], 71.4286, places=3)

    def test_summary_does_not_claim_cloud_thermal_or_final_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_candidate(root, "candidate", 0.8, 0.8, 12.0, 3000)
            summary = build_summary(root)

        self.assertEqual(summary["decision_status"], "pending_qualitative_and_target_laptop_review")
        self.assertFalse(summary["thermal_evidence_valid"])
        self.assertIn("proxy", summary["methodology_note"].lower())
        self.assertEqual(summary["candidates"][0]["license_and_lineage_review"], "pending")


if __name__ == "__main__":
    unittest.main()
