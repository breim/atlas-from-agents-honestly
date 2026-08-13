import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-hit-returns-its-parent", "the model reads the clause, not the sentence"),
    ("two-hits-sharing-a-parent-return-it-once", "one clause is sent once"),
    ("parents-come-back-in-first-hit-order", "the retriever's ranking survives expansion"),
    ("a-chunk-without-a-parent-returns-itself", "an orphan chunk is its own parent"),
    ("an-unknown-hit-is-skipped", "a stale id is skipped, not raised"),
    ("no-hits-expand-to-nothing", "no hits is an empty list"),
)


class ParentChildChunks(unittest.TestCase):
    def setUp(self):
        self.expand = load_impl(__file__).expand

    def run_case(self, entry: dict) -> list:
        return self.expand(entry["hits"], FIXTURE["chunks"], FIXTURE["parents"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["expanded"])

    def test_no_passage_is_ever_sent_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                out = self.run_case(entry)
                self.assertEqual(len(set(out)), len(out))

    def test_every_returned_passage_traces_to_a_hit(self):
        by_id = {chunk["id"]: chunk for chunk in FIXTURE["chunks"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                reachable = set()
                for hit in entry["hits"]:
                    chunk = by_id.get(hit)
                    if chunk is None:
                        continue
                    parent = chunk["parentId"]
                    reachable.add(FIXTURE["parents"][parent] if parent else chunk["text"])
                for text in self.run_case(entry):
                    self.assertIn(text, reachable)
