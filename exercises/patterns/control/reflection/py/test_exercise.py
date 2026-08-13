import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-first-draft-good-enough-stops-immediately", "a good first draft is not revised"),
    ("improves-until-it-clears-the-threshold", "reflection stops the round it clears the bar"),
    ("the-threshold-is-inclusive", "exactly at the threshold is good enough"),
    ("runs-out-of-rounds-and-returns-the-best", "the budget ends the loop, the best draft wins"),
    ("revision-that-makes-things-worse-does-not-win", "a worse revision is not shipped"),
    ("ties-keep-the-earlier-draft", "an equal score does not displace the incumbent"),
    ("the-budget-cuts-the-run-short", "a round beyond the budget never happens"),
)


class Reflection(unittest.TestCase):
    def setUp(self):
        self.reflect = load_impl(__file__).reflect

    def run_case(self, entry: dict) -> dict:
        return self.reflect(entry["rounds"], FIXTURE["threshold"], entry["maxRounds"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_returned_draft_is_the_best_one_reached(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.run_case(entry)
                reached = entry["rounds"][: outcome["rounds"]]
                self.assertEqual(outcome["score"], max(r["score"] for r in reached))

    def test_rounds_consumed_never_exceeds_the_budget_or_the_script(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                rounds = self.run_case(entry)["rounds"]
                self.assertLessEqual(rounds, entry["maxRounds"])
                self.assertLessEqual(rounds, len(entry["rounds"]))

    def test_stopping_on_the_threshold_means_the_bar_was_cleared(self):
        for entry in FIXTURE["cases"]:
            outcome = self.run_case(entry)
            if outcome["stopped"] != "threshold":
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(
                    entry["rounds"][outcome["rounds"] - 1]["score"], FIXTURE["threshold"]
                )
