import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-fits", "nothing is dropped while the transcript fits"),
    ("drops-the-oldest-first", "the oldest droppable entry goes first"),
    ("pinned-survives-the-cut", "a pinned entry in the middle is still pinned"),
    ("pinned-alone-exceeds-the-budget", "a pinned entry is kept even when it blows the budget"),
    ("kept-entries-hold-their-original-order", "survivors are returned in transcript order"),
    ("skips-an-oversized-newer-entry", "an oversized recent entry is skipped, not paid for"),
    ("budget-of-zero-keeps-only-what-is-pinned", "a budget of zero still keeps the system prompt"),
)


class ContextCompaction(unittest.TestCase):
    def setUp(self):
        self.compact = load_impl(__file__).compact

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.compact(entry["entries"], entry["budget"]), entry["result"])

    def test_every_entry_is_either_kept_or_dropped(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compact(entry["entries"], entry["budget"])
                self.assertEqual(
                    sorted(result["kept"] + result["dropped"]),
                    sorted(item["id"] for item in entry["entries"]),
                )

    def test_no_pinned_entry_is_ever_dropped(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                dropped = self.compact(entry["entries"], entry["budget"])["dropped"]
                for item in entry["entries"]:
                    if item["pinned"]:
                        self.assertNotIn(item["id"], dropped)

    def test_the_droppable_part_stays_within_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.compact(entry["entries"], entry["budget"])["kept"]
                cost = sum(item["tokens"] for item in entry["entries"] if item["id"] in kept)
                pinned_cost = sum(item["tokens"] for item in entry["entries"] if item["pinned"])
                self.assertLessEqual(cost, max(entry["budget"], pinned_cost))
