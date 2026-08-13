import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-first-batch-starts-at-the-beginning", "no cursor means start at the top"),
    ("a-cursor-resumes-after-the-last-item-handed-out", "the cursor is not re-handed out"),
    ("the-final-batch-can-be-short", "a partial batch is a valid batch"),
    ("a-batch-that-exactly-consumes-the-rest-is-done", "landing on the end reports done"),
    ("a-cursor-at-the-end-yields-nothing", "an empty batch is a terminal state"),
    ("a-batch-larger-than-the-remainder-does-not-overrun", "an oversized batch takes what exists"),
    ("an-unknown-cursor-restarts-from-the-beginning", "a stale id restarts rather than skips"),
)


class BatchIterator(unittest.TestCase):
    def setUp(self):
        self.next_batch = load_impl(__file__).next_batch

    def run_case(self, entry: dict) -> dict:
        return self.next_batch(FIXTURE["items"], entry["size"], entry["cursor"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_batch_never_exceeds_its_size(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(self.run_case(entry)["batch"]), entry["size"])

    def test_a_batch_is_a_contiguous_slice_in_order(self):
        for entry in FIXTURE["cases"]:
            batch = self.run_case(entry)["batch"]
            if not batch:
                continue
            with self.subTest(entry["id"]):
                start = FIXTURE["items"].index(batch[0])
                self.assertEqual(batch, FIXTURE["items"][start : start + len(batch)])

    def test_iterating_from_the_start_visits_every_item_once(self):
        for size in (1, 2, 3, 5, 99):
            with self.subTest(size=size):
                seen: list = []
                cursor = None
                done = False
                while not done:
                    step = self.next_batch(FIXTURE["items"], size, cursor)
                    seen.extend(step["batch"])
                    cursor = step["cursor"]
                    done = step["done"]
                self.assertEqual(seen, FIXTURE["items"])
