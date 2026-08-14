import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-first-draft-over-the-bar-converges-immediately", "a good first draft ends the loop"),
    ("the-threshold-is-inclusive", "exactly at the bar has converged"),
    ("feedback-drives-the-loop-until-it-converges", "acting on feedback reaches the bar"),
    ("repeated-feedback-stalls-the-loop", "an evaluator repeating itself ends the loop"),
    ("a-stall-returns-the-best-draft-not-the-last", "a stall still returns the best work"),
    ("alternating-feedback-does-not-count-as-a-stall", "a zigzag is still movement"),
    ("running-out-of-rounds-returns-the-best-so-far", "the budget cuts before a later win"),
    ("ties-keep-the-earlier-draft", "an equal score does not displace the incumbent"),
)


class EvaluatorOptimizer(unittest.TestCase):
    def setUp(self):
        self.optimise = load_impl(__file__).optimise

    def run_case(self, entry: dict) -> dict:
        return self.optimise(entry["rounds"], FIXTURE["threshold"], FIXTURE["maxRounds"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_returned_draft_is_the_best_one_reached(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                reached = entry["rounds"][: result["rounds"]]
                self.assertEqual(result["score"], max(r["score"] for r in reached))

    def test_rounds_consumed_never_exceeds_the_budget_or_the_script(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                rounds = self.run_case(entry)["rounds"]
                self.assertLessEqual(rounds, FIXTURE["maxRounds"])
                self.assertLessEqual(rounds, len(entry["rounds"]))

    def test_converging_means_the_bar_was_cleared(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["stopped"] != "converged":
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(
                    entry["rounds"][result["rounds"] - 1]["score"], FIXTURE["threshold"]
                )

    def test_stalling_means_the_evaluator_repeated_itself(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["stopped"] != "stalled":
                continue
            with self.subTest(entry["id"]):
                index = result["rounds"] - 1
                self.assertEqual(
                    entry["rounds"][index]["feedback"], entry["rounds"][index - 1]["feedback"]
                )

    def test_nothing_after_the_stop_is_ever_consumed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                trimmed = self.optimise(
                    entry["rounds"][: result["rounds"]],
                    FIXTURE["threshold"],
                    FIXTURE["maxRounds"],
                )
                self.assertEqual(trimmed, result)
