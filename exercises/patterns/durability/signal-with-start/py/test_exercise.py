import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-signal-to-nothing-starts-a-workflow", "a cold workflow is started on demand"),
    ("a-signal-to-a-running-workflow-does-not-start-one", "a live workflow is not restarted"),
    ("two-signals-start-one-workflow", "the second signal finds the workflow already up"),
    ("distinct-ids-start-distinct-workflows", "ids are independent"),
    ("no-signal-is-ever-dropped-on-the-start-path", "the signal that started it still arrives"),
    ("no-signals-start-nothing", "nothing in, nothing started"),
)


class SignalWithStart(unittest.TestCase):
    def setUp(self):
        self.signal_with_start = load_impl(__file__).signal_with_start

    def run_case(self, entry: dict) -> dict:
        return self.signal_with_start(entry["running"], entry["signals"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_no_workflow_is_started_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                started = self.run_case(entry)["started"]
                self.assertEqual(len(set(started)), len(started))

    def test_an_already_running_workflow_is_never_started(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for workflow_id in self.run_case(entry)["started"]:
                    self.assertNotIn(workflow_id, entry["running"])

    def test_every_signal_is_delivered_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_id: dict = {}
                for signal in entry["signals"]:
                    by_id.setdefault(signal["workflowId"], []).append(signal["payload"])
                self.assertEqual(self.run_case(entry)["workflows"], by_id)
