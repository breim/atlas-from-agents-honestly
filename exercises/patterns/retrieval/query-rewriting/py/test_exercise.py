import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-unknown-term-passes-through", "a term with no synonyms is left alone"),
    ("expands-a-known-term", "a known term brings its synonyms"),
    ("expands-several-terms-in-query-order", "additions follow the order of their triggers"),
    ("never-duplicates-a-term-already-present", "a synonym already in the query is not repeated"),
    ("a-repeated-term-expands-once", "a repeated trigger expands once"),
    ("an-empty-query-stays-empty", "an empty query is not a stray space"),
)


class QueryRewriting(unittest.TestCase):
    def setUp(self):
        self.rewrite = load_impl(__file__).rewrite

    def out(self, query: str) -> list:
        return self.rewrite(query, FIXTURE["synonyms"]).split()

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.rewrite(entry["query"], FIXTURE["synonyms"]), entry["rewritten"])

    def test_the_original_terms_always_come_first_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                originals = list(dict.fromkeys(entry["query"].split()))
                self.assertEqual(self.out(entry["query"])[: len(originals)], originals)

    def test_no_term_appears_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                out = self.out(entry["query"])
                self.assertEqual(len(set(out)), len(out))

    def test_expansion_only_ever_adds(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                out = set(self.out(entry["query"]))
                for term in entry["query"].split():
                    self.assertIn(term, out)
