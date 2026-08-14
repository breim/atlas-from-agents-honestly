import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-fits-uncompacted", "a short transcript is left alone"),
    ("the-oldest-turn-is-summarised-first", "compaction eats from the old end"),
    ("the-summary-cost-counts-against-the-budget", "the summary is not free"),
    ("dropping-a-fact-heavy-turn-can-cost-more-than-keeping-it", "freeing tokens is not monotone"),
    ("a-fact-repeated-across-turns-is-summarised-once", "the summary deduplicates"),
    ("nothing-fits-even-fully-compacted", "a transcript can be unfixable"),
    ("an-empty-transcript-fits-trivially", "nothing to compact is a fit"),
)


class Compaction(unittest.TestCase):
    def setUp(self):
        self.compact = load_impl(__file__).compact

    def run_case(self, entry: dict) -> dict:
        return self.compact(entry["turns"], FIXTURE["budget"], FIXTURE["costPerFact"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_no_fact_from_a_dropped_turn_is_ever_lost(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for turn in entry["turns"]:
                    if turn["id"] in result["kept"]:
                        continue
                    for fact in turn["facts"]:
                        self.assertIn(fact, result["summarised"])

    def test_the_kept_turns_are_always_the_newest(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)["kept"]
                suffix = [t["id"] for t in entry["turns"][len(entry["turns"]) - len(kept) :]]
                self.assertEqual(kept, suffix)

    def test_tokens_is_kept_turns_plus_summary_cost(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                kept_tokens = sum(
                    t["tokens"] for t in entry["turns"] if t["id"] in result["kept"]
                )
                self.assertEqual(
                    result["tokens"],
                    kept_tokens + len(result["summarised"]) * FIXTURE["costPerFact"],
                )

    def test_fits_is_true_exactly_when_within_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["fits"], result["tokens"] <= FIXTURE["budget"])

    def test_a_summarised_fact_never_appears_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                summarised = self.run_case(entry)["summarised"]
                self.assertEqual(len(set(summarised)), len(summarised))
