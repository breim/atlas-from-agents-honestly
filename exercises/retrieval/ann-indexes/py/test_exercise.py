import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-perfect-index-recalls-everything", "an exact match recalls everything"),
    ("order-does-not-affect-recall", "recall is a set measure"),
    ("a-missed-neighbour-lowers-recall", "a missed neighbour costs recall"),
    ("recall-counts-overlap-not-position", "one in three is one in three"),
    ("a-superset-still-recalls-everything", "returning extra does not lower recall"),
    ("an-empty-approximate-result-recalls-nothing", "finding nothing recalls nothing"),
    ("an-empty-exact-set-is-vacuously-perfect", "a query with no answers cannot fail"),
)


class AnnIndexes(unittest.TestCase):
    def setUp(self):
        self.measure = load_impl(__file__).measure

    def run_case(self, entry: dict) -> dict:
        return self.measure(entry["exact"], entry["approximate"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_recall_is_always_between_zero_and_full(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                recall = self.run_case(entry)["recallBps"]
                self.assertGreaterEqual(recall, 0)
                self.assertLessEqual(recall, 10000)

    def test_missed_is_exactly_what_the_index_failed_to_return(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    self.run_case(entry)["missed"],
                    [d for d in entry["exact"] if d not in entry["approximate"]],
                )

    def test_recall_and_missed_always_agree(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if not entry["exact"]:
                    rate = 10000
                else:
                    found = len(entry["exact"]) - len(result["missed"])
                    rate = math.floor(found * 10000 / len(entry["exact"]) + 0.5)
                self.assertEqual(result["recallBps"], rate)

    def test_shuffling_either_list_never_changes_recall(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = self.measure(
                    list(reversed(entry["exact"])), list(reversed(entry["approximate"]))
                )
                self.assertEqual(flipped["recallBps"], self.run_case(entry)["recallBps"])

    def test_adding_a_correct_neighbour_never_lowers_recall(self):
        for entry in FIXTURE["cases"]:
            if not entry["exact"]:
                continue
            with self.subTest(entry["id"]):
                better = self.measure(
                    entry["exact"], [*entry["approximate"], entry["exact"][0]]
                )
                self.assertGreaterEqual(
                    better["recallBps"], self.run_case(entry)["recallBps"]
                )
