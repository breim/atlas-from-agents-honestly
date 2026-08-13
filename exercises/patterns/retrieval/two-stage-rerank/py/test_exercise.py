import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("shortlist-then-rerank", "the reranker decides the order within the shortlist"),
    ("the-reranker-reorders-the-shortlist", "a full shortlist is still fully reordered"),
    (
        "a-document-outside-the-shortlist-cannot-be-rescued",
        "stage two never sees what stage one dropped",
    ),
    ("topk-caps-the-output", "topK trims after reranking, not before"),
    ("a-shortlist-wider-than-the-candidate-set", "an oversized shortlist is not an index error"),
    ("ties-break-on-id-in-both-stages", "both sorts resolve ties the same way"),
    ("no-candidates-rank-to-nothing", "no candidates is an empty list, not a crash"),
)


class TwoStageRerank(unittest.TestCase):
    def setUp(self):
        self.rerank = load_impl(__file__).rerank

    def run_case(self, entry: dict) -> list:
        return self.rerank(entry["candidates"], entry["shortlist"], entry["topK"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["ranked"])

    def test_the_output_never_exceeds_topk_or_the_shortlist(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ranked = self.run_case(entry)
                self.assertLessEqual(len(ranked), entry["topK"])
                self.assertLessEqual(len(ranked), entry["shortlist"])

    def test_every_result_survived_stage_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ordered = sorted(entry["candidates"], key=lambda c: (-c["cheap"], c["id"]))
                survivors = {c["id"] for c in ordered[: entry["shortlist"]]}
                for doc_id in self.run_case(entry):
                    self.assertIn(doc_id, survivors)

    def test_the_output_is_ordered_by_descending_precise_score(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                precise = {c["id"]: c["precise"] for c in entry["candidates"]}
                ranked = self.run_case(entry)
                for earlier, later in zip(ranked, ranked[1:]):
                    self.assertGreaterEqual(precise[earlier], precise[later])
