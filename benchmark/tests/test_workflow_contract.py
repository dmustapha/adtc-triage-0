import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]


class WorkflowContractTests(unittest.TestCase):
    def test_workflow_is_single_job_pinned_and_bounded(self):
        workflow = (ROOT / ".github/workflows/model-bakeoff.yml").read_text()

        self.assertIn("timeout-minutes: 350", workflow)
        self.assertNotIn("matrix:", workflow)
        self.assertIn("ac2e137dca65ea3b09d997774f17dd8907b489fb", workflow)
        self.assertIn("benchmark/run_bakeoff.sh", workflow)
        self.assertIn("if: always()", workflow)

    def test_runner_enforces_offline_inference_and_target_limits(self):
        runner = (ROOT / "benchmark/run_bakeoff.sh").read_text()

        self.assertGreaterEqual(runner.count("--network none"), 2)
        self.assertGreaterEqual(runner.count("--memory 7.5g"), 2)
        self.assertGreaterEqual(runner.count("--cpus 4"), 2)
        self.assertIn("sha256sum --check", runner)
        self.assertIn("--mode audit", runner)
        self.assertIn("benchmark.clinical_runner", runner)
        self.assertIn('rm -f "$model_path"', runner)


if __name__ == "__main__":
    unittest.main()
