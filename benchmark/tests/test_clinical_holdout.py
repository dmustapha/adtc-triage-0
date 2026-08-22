import unittest

from benchmark.clinical_holdout import (
    extract_answer,
    load_holdout,
    score_responses,
)


class ClinicalHoldoutTests(unittest.TestCase):
    def setUp(self):
        self.items = load_holdout()

    def test_holdout_is_large_balanced_and_keyed(self):
        self.assertGreaterEqual(len(self.items), 20)
        self.assertGreaterEqual(
            len({item["category"] for item in self.items}),
            6,
        )
        for item in self.items:
            self.assertIn(item["answer"], item["options"])
            self.assertIn(item["weight"], (1, 2))
            self.assertEqual(set(item["options"]), {"A", "B", "C", "D"})

    def test_extract_answer_accepts_common_deterministic_formats(self):
        self.assertEqual(extract_answer("B"), "B")
        self.assertEqual(extract_answer("Answer: C"), "C")
        self.assertEqual(extract_answer("The correct choice is D."), "D")
        self.assertIsNone(extract_answer("I cannot determine this."))

    def test_weighted_score_prioritizes_critical_safety(self):
        sample = [
            {"id": "critical", "answer": "A", "weight": 2},
            {"id": "standard", "answer": "B", "weight": 1},
        ]
        report = score_responses(sample, {"critical": "A", "standard": "C"})

        self.assertEqual(report["correct"], 1)
        self.assertEqual(report["total"], 2)
        self.assertAlmostEqual(report["weighted_accuracy"], 2 / 3)


if __name__ == "__main__":
    unittest.main()
