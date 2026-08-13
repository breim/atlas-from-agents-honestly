import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-task-goes-to-the-first-queue-that-can-serve-it", "declaration order decides among equals"),
    ("a-specialised-need-picks-the-only-queue-with-it", "a unique capability routes uniquely"),
    ("every-need-must-be-covered-by-one-queue", "one queue must cover the whole task"),
    ("needs-spread-across-two-queues-are-unroutable", "partial coverage is not coverage"),
    ("an-unknown-capability-is-unroutable", "a need nothing provides is refused up front"),
    ("a-task-with-no-needs-goes-to-the-first-queue", "no needs is satisfied by anything"),
    ("tasks-keep-their-order-within-a-queue", "a queue is still a queue"),
    ("an-unroutable-task-does-not-block-the-others", "one bad task is not a batch failure"),
    ("no-tasks-route-nowhere", "nothing in, nothing routed"),
)


class WorkerSpecificQueues(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_case(self, entry: dict) -> dict:
        return self.route(entry["tasks"], FIXTURE["queues"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_task_is_routed_or_refused_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                seen = [t for ids in result["routed"].values() for t in ids]
                self.assertEqual(
                    sorted(seen + result["unroutable"]),
                    sorted(task["task"] for task in entry["tasks"]),
                )

    def test_every_routed_task_landed_on_a_covering_queue(self):
        by_name = {q["name"]: q for q in FIXTURE["queues"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_task = {t["task"]: t for t in entry["tasks"]}
                for name, ids in self.run_case(entry)["routed"].items():
                    for task_id in ids:
                        for need in by_task[task_id]["needs"]:
                            self.assertIn(need, by_name[name]["provides"])

    def test_nothing_refusable_was_actually_servable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_task = {t["task"]: t for t in entry["tasks"]}
                for task_id in self.run_case(entry)["unroutable"]:
                    needs = by_task[task_id]["needs"]
                    servable = any(
                        all(need in q["provides"] for need in needs) for q in FIXTURE["queues"]
                    )
                    self.assertFalse(servable)
