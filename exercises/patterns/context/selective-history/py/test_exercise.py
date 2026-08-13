import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-scores-above-the-threshold", "a relevant history is kept whole"),
    ("drops-what-scores-below", "an irrelevant middle turn is dropped"),
    ("the-tail-is-kept-regardless-of-score", "the tail outranks the scorer"),
    ("the-threshold-is-inclusive", "a score exactly on the threshold is kept"),
    ("kept-entries-hold-their-original-order", "survivors are returned in transcript order"),
    ("a-tail-longer-than-the-history-keeps-everything", "an oversized tail is not an index error"),
)


class SelectiveHistory(unittest.TestCase):
    def setUp(self):
        self.select = load_impl(__file__).select

    def run_case(self, entry: dict) -> list:
        return self.select(entry["history"], entry["threshold"], entry["keepLast"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["kept"])

    def test_the_tail_is_always_present(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)
                tail_start = max(0, len(entry["history"]) - entry["keepLast"])
                for turn in entry["history"][tail_start:]:
                    self.assertIn(turn["id"], kept)

    def test_nothing_below_the_threshold_survives_outside_the_tail(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)
                tail_start = max(0, len(entry["history"]) - entry["keepLast"])
                for index, turn in enumerate(entry["history"]):
                    if index < tail_start and turn["score"] < entry["threshold"]:
                        self.assertNotIn(turn["id"], kept)
