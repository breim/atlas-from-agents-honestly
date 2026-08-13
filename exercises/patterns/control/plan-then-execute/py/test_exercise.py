import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-valid-plan-runs-in-order", "a dependency chain runs front to back"),
    ("independent-steps-keep-declaration-order", "independence does not license reordering"),
    ("an-unknown-tool-rejects-the-whole-plan", "a bad step two prevents step one from running"),
    ("a-dependency-on-a-missing-step-rejects-the-plan", "a dependency on nothing is caught"),
    ("a-forward-dependency-rejects-the-plan", "a step cannot depend on a later step"),
    ("a-duplicate-step-id-rejects-the-plan", "two steps cannot share an id"),
    ("a-self-dependency-rejects-the-plan", "a step cannot depend on itself"),
    ("an-empty-plan-succeeds-having-done-nothing", "an empty plan is valid and does nothing"),
)


class PlanThenExecute(unittest.TestCase):
    def setUp(self):
        self.run = load_impl(__file__).run

    def execute(self, entry: dict) -> dict:
        return self.run(entry["plan"], FIXTURE["tools"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.execute(entry), entry["result"])

    def test_a_rejected_plan_executes_nothing_at_all(self):
        for entry in FIXTURE["cases"]:
            outcome = self.execute(entry)
            if outcome["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["executed"], [])

    def test_an_accepted_plan_executes_every_step_exactly_once(self):
        for entry in FIXTURE["cases"]:
            outcome = self.execute(entry)
            if not outcome["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["executed"], [step["id"] for step in entry["plan"]])

    def test_every_dependency_ran_before_the_step_that_needed_it(self):
        for entry in FIXTURE["cases"]:
            outcome = self.execute(entry)
            if not outcome["ok"]:
                continue
            with self.subTest(entry["id"]):
                order = outcome["executed"]
                for step in entry["plan"]:
                    for need in step["needs"]:
                        self.assertLess(order.index(need), order.index(step["id"]))
