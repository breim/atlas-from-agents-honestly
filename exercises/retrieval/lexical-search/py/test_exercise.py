import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-single-term-ranks-by-frequency", "more mentions score higher, linearly"),
    ("an-exact-identifier-dominates-the-ranking", "a rare identifier beats a common word"),
    ("matching-more-terms-raises-the-score", "covering more of the query scores more"),
    ("a-zero-weight-term-matches-nothing", "a word in every document discriminates nothing"),
    ("a-term-nobody-weighted-contributes-nothing", "an unweighted term is not a signal"),
    ("a-term-in-no-document-returns-nothing", "no match is an empty result"),
    ("a-repeated-query-term-is-counted-once", "repeating a term in the query changes nothing"),
    ("topk-caps-the-hits", "topK trims the ranking"),
    ("an-empty-query-matches-nothing", "an empty query is not a match-all"),
)


class LexicalSearch(unittest.TestCase):
    def setUp(self):
        self.search = load_impl(__file__).search

    def run_case(self, entry: dict) -> list:
        return self.search(entry["query"], FIXTURE["docs"], FIXTURE["idf"], entry["topK"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["hits"])

    def test_no_hit_ever_scores_zero(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for hit in self.run_case(entry):
                    self.assertGreater(hit["score"], 0)

    def test_the_score_matches_the_term_weights(self):
        by_id = {doc["id"]: doc for doc in FIXTURE["docs"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                terms = list(dict.fromkeys(entry["query"]))
                for hit in self.run_case(entry):
                    doc = by_id[hit["id"]]
                    score = sum(
                        doc["terms"].count(term) * FIXTURE["idf"].get(term, 0) for term in terms
                    )
                    self.assertEqual(hit["score"], score)

    def test_query_term_order_never_changes_the_ranking(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = self.search(
                    list(reversed(entry["query"])),
                    FIXTURE["docs"],
                    FIXTURE["idf"],
                    entry["topK"],
                )
                self.assertEqual(flipped, self.run_case(entry))

    def test_results_are_ordered_by_descending_score(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                hits = self.run_case(entry)
                for earlier, later in zip(hits, hits[1:]):
                    self.assertGreaterEqual(earlier["score"], later["score"])

    def test_adding_a_zero_weight_term_changes_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                padded = self.search(
                    [*entry["query"], "the"], FIXTURE["docs"], FIXTURE["idf"], entry["topK"]
                )
                self.assertEqual(padded, self.run_case(entry))
