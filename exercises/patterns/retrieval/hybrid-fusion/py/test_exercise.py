import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-single-ranking-is-passed-through", "fusing one ranking changes nothing"),
    ("identical-rankings-do-not-reorder", "agreement preserves the order"),
    ("a-document-ranked-well-by-both-wins", "the document both rankers like comes first"),
    ("consistent-mid-rank-beats-one-first-place", "consistency outscores a single first place"),
    (
        "a-document-missing-from-one-ranking-scores-only-where-it-appears",
        "absence is zero, not a penalty",
    ),
    ("ties-break-on-document-id", "a tie resolves the same way every run"),
    ("no-rankings-fuse-to-nothing", "no input is an empty list, not a crash"),
)


class HybridFusion(unittest.TestCase):
    def setUp(self):
        self.fuse = load_impl(__file__).fuse

    def score(self, rankings: list, doc_id: str) -> float:
        total = 0.0
        for ranking in rankings:
            if doc_id in ranking:
                total += 1 / (FIXTURE["k"] + ranking.index(doc_id) + 1)
        return total

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.fuse(entry["rankings"], FIXTURE["k"]), entry["fused"])

    def test_the_fused_set_is_exactly_the_union_of_the_inputs(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                union = {doc for ranking in entry["rankings"] for doc in ranking}
                self.assertEqual(sorted(self.fuse(entry["rankings"], FIXTURE["k"])), sorted(union))

    def test_the_output_is_ordered_by_descending_rrf_score(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                fused = self.fuse(entry["rankings"], FIXTURE["k"])
                for earlier, later in zip(fused, fused[1:]):
                    self.assertGreaterEqual(
                        self.score(entry["rankings"], earlier),
                        self.score(entry["rankings"], later),
                    )

    def test_fusion_is_independent_of_ranking_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    self.fuse(list(reversed(entry["rankings"])), FIXTURE["k"]),
                    self.fuse(entry["rankings"], FIXTURE["k"]),
                )
