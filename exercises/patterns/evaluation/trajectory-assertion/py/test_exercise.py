import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-required-path-in-order-passes", "the intended path passes"),
    ("extra-steps-between-required-ones-are-fine", "the assertion does not pin the exact sequence"),
    ("a-missing-required-step-fails", "a skipped step is caught"),
    ("the-right-steps-in-the-wrong-order-fail", "authorising after the effect is a failure"),
    ("a-forbidden-step-fails-however-good-the-path-looks", "a forbidden step fails the run"),
    ("violations-are-reported-together", "every violation is reported, not just the first"),
    ("a-repeated-required-step-still-satisfies-the-order", "a repeat does not break the order"),
    ("an-empty-trajectory-misses-everything", "doing nothing fails every requirement"),
)


class TrajectoryAssertion(unittest.TestCase):
    def setUp(self):
        self.assert_path = load_impl(__file__).assert_path

    def run_case(self, entry: dict) -> dict:
        return self.assert_path(entry["steps"], FIXTURE["spec"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_passing_means_no_violations(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["passed"], not result["violations"])

    def test_a_forbidden_step_never_passes(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tainted = [*entry["steps"], FIXTURE["spec"]["forbids"][0]]
                self.assertFalse(self.assert_path(tainted, FIXTURE["spec"])["passed"])

    def test_dropping_a_required_step_never_keeps_it_passing(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["passed"]:
                continue
            with self.subTest(entry["id"]):
                for required in FIXTURE["spec"]["requires"]:
                    without = [s for s in entry["steps"] if s != required]
                    self.assertFalse(self.assert_path(without, FIXTURE["spec"])["passed"])

    def test_reversing_a_passing_trajectory_does_not_pass(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["passed"] or len(FIXTURE["spec"]["requires"]) < 2:
                continue
            with self.subTest(entry["id"]):
                reversed_steps = list(reversed(entry["steps"]))
                self.assertFalse(self.assert_path(reversed_steps, FIXTURE["spec"])["passed"])
