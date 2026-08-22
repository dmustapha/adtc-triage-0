import unittest

from benchmark.clinical_runner import build_mcq_prompt, run_suite


class FakeLlama:
    def __init__(self, answers):
        self.answers = iter(answers)

    def create_chat_completion(self, **kwargs):
        return {
            "choices": [
                {"message": {"content": next(self.answers)}, "finish_reason": "stop"}
            ]
        }


class ClinicalRunnerTests(unittest.TestCase):
    def test_mcq_prompt_includes_every_choice_but_not_answer_key(self):
        item = {
            "question": "What is safest?",
            "options": {"A": "One", "B": "Two", "C": "Three", "D": "Four"},
            "answer": "B",
        }
        prompt = build_mcq_prompt(item)

        self.assertIn("A. One", prompt)
        self.assertIn("D. Four", prompt)
        self.assertNotIn('"answer"', prompt)
        self.assertNotIn("Correct answer", prompt)

    def test_suite_scores_holdout_and_preserves_participant_responses(self):
        holdout = [
            {
                "id": "q1",
                "category": "safety",
                "question": "Choose",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "answer": "A",
                "weight": 2,
            }
        ]
        prompts = [{"prompt_id": "tp_001", "prompt": "Help safely"}]
        result = run_suite(FakeLlama(["Answer: A", "A safe response"]), holdout, prompts)

        self.assertEqual(result["holdout"]["weighted_accuracy"], 1.0)
        self.assertEqual(result["holdout"]["details"][0]["finish_reason"], "stop")
        self.assertEqual(result["participant_prompts"][0]["response"], "A safe response")
        self.assertEqual(result["participant_prompts"][0]["finish_reason"], "stop")
        self.assertGreaterEqual(result["participant_prompts"][0]["elapsed_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
