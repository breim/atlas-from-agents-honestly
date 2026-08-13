import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("every-step-succeeds-and-nothing-compensates", "a clean run undoes nothing"),
    ("a-failure-compensates-in-reverse-order", "cleanup unwinds the way it wound up"),
    ("the-failing-step-is-not-compensated", "an effect that never happened is not undone"),
    ("failing-on-the-first-step-compensates-nothing", "nothing completed means nothing to undo"),
    ("steps-after-the-failure-never-run", "a failed saga does not keep going"),
    ("a-single-step-saga-succeeds", "one step is still a saga"),
    ("an-empty-saga-succeeds-trivially", "an empty saga is a success"),
)


class SagaForTools(unittest.TestCase):
    def setUp(self):
        self.run_saga = load_impl(__file__).run_saga

    def run_case(self, entry: dict) -> dict:
        return self.run_saga(entry["steps"], entry["failAt"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_compensation_is_exactly_the_completed_steps_reversed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                expected_comp = [] if result["ok"] else result["completed"][::-1]
                self.assertEqual(result["compensated"], expected_comp)

    def test_the_failing_step_never_appears(self):
        for entry in FIXTURE["cases"]:
            if entry["failAt"] is None:
                continue
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertNotIn(entry["failAt"], result["completed"])
                self.assertNotIn(entry["failAt"], result["compensated"])

    def test_completed_steps_are_a_prefix_of_the_declared_steps(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                completed = self.run_case(entry)["completed"]
                self.assertEqual(completed, entry["steps"][: len(completed)])
