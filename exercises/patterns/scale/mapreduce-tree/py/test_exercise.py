import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-single-item-needs-no-merging", "one item is already the answer"),
    ("a-full-group-merges-in-one-level", "a full group collapses in one round"),
    ("an-odd-item-carries-to-the-next-level", "a lone item carries rather than overfilling"),
    ("four-items-balance-into-two-levels", "a power of the fan-in balances exactly"),
    ("a-wider-fan-in-flattens-the-tree", "a bigger fan-in means fewer rounds"),
    ("the-tree-deepens-as-the-input-grows", "more items means more levels, not bigger merges"),
    ("no-items-reduce-to-nothing", "nothing to reduce is None, not a crash"),
)


class MapReduceTree(unittest.TestCase):
    def setUp(self):
        self.reduce_tree = load_impl(__file__).reduce_tree

    def run_case(self, entry: dict) -> dict:
        return self.reduce_tree(entry["items"], entry["fanIn"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_no_merge_step_ever_exceeds_the_fan_in(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                width = len(entry["items"])
                for level in self.run_case(entry)["levels"]:
                    self.assertGreaterEqual(len(level), math.ceil(width / entry["fanIn"]))
                    width = len(level)

    def test_every_level_is_strictly_narrower(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                width = len(entry["items"])
                for level in self.run_case(entry)["levels"]:
                    self.assertLess(len(level), width)
                    width = len(level)

    def test_the_result_is_the_single_value_the_last_level_holds(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.run_case(entry)
                if not outcome["levels"]:
                    first = entry["items"][0] if entry["items"] else None
                    self.assertEqual(outcome["result"], first)
                    continue
                self.assertEqual(len(outcome["levels"][-1]), 1)
                self.assertEqual(outcome["result"], outcome["levels"][-1][0])

    def test_every_original_item_survives_into_the_result(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)["result"]
                for item in entry["items"]:
                    self.assertIn(item, result)
