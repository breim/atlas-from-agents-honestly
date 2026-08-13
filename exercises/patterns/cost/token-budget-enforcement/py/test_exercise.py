import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("calls-inside-the-budget-all-run", "affordable work goes through"),
    ("spending-exactly-the-budget-is-allowed", "the last token is spendable"),
    ("one-token-over-is-refused", "the ceiling is a ceiling"),
    ("a-call-is-refused-whole-never-truncated", "a call is not trimmed to fit"),
    ("a-refusal-consumes-nothing-and-the-run-continues", "a later smaller call still fits"),
    ("a-call-larger-than-the-whole-budget-can-never-run", "no budget would have helped"),
    ("a-zero-token-call-always-fits", "a free call is free even at the ceiling"),
    ("no-calls-spend-nothing", "an empty run spends nothing"),
)


class TokenBudgetEnforcement(unittest.TestCase):
    def setUp(self):
        self.enforce = load_impl(__file__).enforce

    def run_case(self, entry: dict) -> dict:
        return self.enforce(entry["calls"], FIXTURE["budget"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_budget_is_never_exceeded(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(self.run_case(entry)["spent"], FIXTURE["budget"])

    def test_spent_is_exactly_the_cost_of_what_executed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                tokens = {call["id"]: call["tokens"] for call in entry["calls"]}
                self.assertEqual(result["spent"], sum(tokens[i] for i in result["executed"]))

    def test_every_call_is_either_executed_or_refused(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["executed"] + result["refused"]),
                    sorted(call["id"] for call in entry["calls"]),
                )

    def test_a_smaller_budget_never_executes_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tighter = self.enforce(entry["calls"], FIXTURE["budget"] - 1)
                self.assertLessEqual(
                    len(tighter["executed"]), len(self.run_case(entry)["executed"])
                )
