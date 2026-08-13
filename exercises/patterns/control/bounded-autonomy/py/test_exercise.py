import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-action-inside-every-bound-is-allowed", "a legitimate action goes through"),
    ("the-action-count-is-capped", "the agent stops after its allotted actions"),
    ("spend-accumulates-across-actions", "two affordable actions can be unaffordable together"),
    ("spending-exactly-the-budget-is-allowed", "the last cent is spendable"),
    ("a-tool-outside-the-grant-is-denied", "an ungranted tool never runs"),
    ("a-denial-consumes-no-budget", "a refusal does not starve the rest of the run"),
    ("scope-is-checked-before-spend", "the reason code names the real problem"),
    ("no-actions-consume-nothing", "an empty run is an empty result"),
)


class BoundedAutonomy(unittest.TestCase):
    def setUp(self):
        self.enforce = load_impl(__file__).enforce

    def run_case(self, entry: dict) -> dict:
        return self.enforce(entry["actions"], FIXTURE["budget"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_action_is_either_allowed_or_denied(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    len(result["allowed"]) + len(result["denied"]), len(entry["actions"])
                )

    def test_no_ungranted_tool_is_ever_allowed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for tool in self.run_case(entry)["allowed"]:
                    self.assertIn(tool, FIXTURE["budget"]["tools"])

    def test_neither_bound_is_ever_exceeded(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                allowed = self.run_case(entry)["allowed"]
                self.assertLessEqual(len(allowed), FIXTURE["budget"]["actions"])

                remaining = list(entry["actions"])
                spent = 0
                for tool in allowed:
                    index = next(i for i, a in enumerate(remaining) if a["tool"] == tool)
                    spent += remaining.pop(index)["cents"]
                self.assertLessEqual(spent, FIXTURE["budget"]["cents"])
