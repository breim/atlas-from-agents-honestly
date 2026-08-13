import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-distant-deadline-goes-to-batch", "time to spare buys the cheap lane"),
    ("a-deadline-inside-the-batch-window-goes-sync", "a waiting user pays for speed"),
    ("a-deadline-exactly-at-the-turnaround-goes-to-batch", "exactly enough time is enough"),
    ("one-millisecond-inside-the-turnaround-goes-sync", "one millisecond short is short"),
    ("a-request-with-no-deadline-is-batchable", "nobody waiting means nothing to miss"),
    ("an-already-missed-deadline-goes-sync", "late is not a reason to be later"),
    ("a-mixed-queue-splits-and-keeps-its-order", "both lanes preserve submission order"),
    ("an-empty-queue-routes-nothing", "nothing queued is nothing routed"),
)


class BatchApiOffload(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_case(self, entry: dict) -> dict:
        return self.route(entry["requests"], FIXTURE["now"], FIXTURE["batchLatencyMs"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_request_lands_in_exactly_one_lane(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["batch"] + result["sync"]),
                    sorted(request["id"] for request in entry["requests"]),
                )

    def test_nothing_batched_could_miss_its_deadline(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_id = {r["id"]: r for r in entry["requests"]}
                for request_id in self.run_case(entry)["batch"]:
                    deadline = by_id[request_id]["deadline"]
                    if deadline is None:
                        continue
                    self.assertLessEqual(FIXTURE["now"] + FIXTURE["batchLatencyMs"], deadline)

    def test_a_longer_batch_turnaround_never_batches_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                slower = self.route(
                    entry["requests"], FIXTURE["now"], FIXTURE["batchLatencyMs"] * 2
                )
                self.assertLessEqual(
                    len(slower["batch"]), len(self.run_case(entry)["batch"])
                )

    def test_each_lane_keeps_the_queue_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                order = [request["id"] for request in entry["requests"]]
                for lane in (result["batch"], result["sync"]):
                    self.assertEqual([i for i in order if i in lane], lane)
