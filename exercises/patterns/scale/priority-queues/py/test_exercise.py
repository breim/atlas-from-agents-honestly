import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("one-priority-is-plain-fifo", "equal priorities keep their line"),
    ("higher-priority-runs-first", "urgency wins over arrival"),
    ("submission-order-breaks-ties", "the tie-break is explicit, not the engine default"),
    ("priorities-interleave-correctly", "three priorities sort into three bands"),
    ("a-late-high-priority-task-still-jumps-the-queue", "arriving last does not mean running last"),
    ("a-flood-of-high-priority-work-starves-the-rest", "plain priority does starve, on purpose"),
    ("an-empty-queue-orders-nothing", "nothing queued is nothing ordered"),
)


class PriorityQueues(unittest.TestCase):
    def setUp(self):
        self.order = load_impl(__file__).order

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.order(entry["tasks"]), entry["order"])

    def test_every_task_runs_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    sorted(self.order(entry["tasks"])),
                    sorted(task["task"] for task in entry["tasks"]),
                )

    def test_priority_never_decreases_along_the_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                priority = {t["task"]: t["priority"] for t in entry["tasks"]}
                ordered = self.order(entry["tasks"])
                for earlier, later in zip(ordered, ordered[1:]):
                    self.assertGreaterEqual(priority[earlier], priority[later])

    def test_equal_priority_tasks_hold_submission_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ordered = self.order(entry["tasks"])
                for level in {task["priority"] for task in entry["tasks"]}:
                    submitted = [t["task"] for t in entry["tasks"] if t["priority"] == level]
                    self.assertEqual([t for t in ordered if t in submitted], submitted)
