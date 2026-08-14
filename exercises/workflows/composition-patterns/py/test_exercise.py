import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("sequential-elapsed-is-the-sum", "one after another costs the sum"),
    ("parallel-elapsed-is-the-slowest-step", "all at once costs the slowest"),
    ("fanout-elapsed-is-the-sum-of-each-waves-slowest", "a cap puts you between the two"),
    ("results-follow-declaration-order-not-completion-order", "finishing first is not being first"),
    ("a-failing-step-does-not-stop-its-siblings", "a parallel failure is contained"),
    ("a-failing-step-does-not-stop-a-sequence-either", "a sequential failure is too"),
    ("a-single-step-costs-the-same-in-every-shape", "one step has no shape to speak of"),
    ("no-steps-take-no-time", "nothing to do takes no time"),
)

MODES = ("sequential", "parallel", "fanout")


class CompositionPatterns(unittest.TestCase):
    def setUp(self):
        self.compose = load_impl(__file__).compose

    def run_case(self, entry: dict) -> dict:
        return self.compose(entry["steps"], entry["mode"], FIXTURE["limit"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_step_is_reported_once_in_declaration_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                order = [step["id"] for step in entry["steps"]]
                self.assertEqual(
                    sorted(result["results"] + result["failed"]), sorted(order)
                )
                for lane in (result["results"], result["failed"]):
                    self.assertEqual([i for i in order if i in lane], lane)

    def test_the_shape_never_changes_which_steps_succeeded(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                baseline = self.run_case(entry)
                for mode in MODES:
                    other = self.compose(entry["steps"], mode, FIXTURE["limit"])
                    self.assertEqual(other["results"], baseline["results"])
                    self.assertEqual(other["failed"], baseline["failed"])

    def test_parallel_is_never_slower_than_fanout_or_sequential(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                elapsed = {
                    mode: self.compose(entry["steps"], mode, FIXTURE["limit"])["elapsed"]
                    for mode in MODES
                }
                self.assertLessEqual(elapsed["parallel"], elapsed["fanout"])
                self.assertLessEqual(elapsed["fanout"], elapsed["sequential"])

    def test_a_failing_step_still_costs_its_time(self):
        for entry in FIXTURE["cases"]:
            if entry["mode"] != "sequential":
                continue
            with self.subTest(entry["id"]):
                total = sum(step["ms"] for step in entry["steps"])
                self.assertEqual(self.run_case(entry)["elapsed"], total)

    def test_an_uncapped_fanout_equals_parallel(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                wide = self.compose(
                    entry["steps"], "fanout", max(1, len(entry["steps"]))
                )["elapsed"]
                parallel = self.compose(entry["steps"], "parallel", FIXTURE["limit"])["elapsed"]
                self.assertEqual(wide, parallel)
