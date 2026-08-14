import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-identical-direction-scores-one", "the same direction is a perfect match"),
    ("magnitude-does-not-affect-similarity", "a seven-times-longer vector scores identically"),
    (
        "a-forty-five-degree-vector-scores-about-point-seven",
        "a diagonal lands where trigonometry says",
    ),
    ("an-orthogonal-vector-scores-zero", "unrelated is zero, not low"),
    ("an-opposite-direction-scores-minus-one", "cosine runs from minus one, not zero"),
    ("the-zero-vector-is-excluded-not-scored", "a directionless vector is not a result"),
    ("a-zero-query-matches-nothing", "a directionless query has nothing to match"),
    ("topk-caps-the-results", "topK trims the ranking"),
)


class Embeddings(unittest.TestCase):
    def setUp(self):
        self.nearest = load_impl(__file__).nearest

    def run_case(self, entry: dict) -> list:
        return self.nearest(entry["query"], FIXTURE["vectors"], entry["topK"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["hits"])

    def test_scaling_a_vector_never_changes_its_score(self):
        for entry in FIXTURE["cases"]:
            if all(x == 0 for x in entry["query"]):
                continue
            with self.subTest(entry["id"]):
                scaled = [
                    {"id": v["id"], "v": [x * 3 for x in v["v"]]} for v in FIXTURE["vectors"]
                ]
                self.assertEqual(
                    self.nearest(entry["query"], scaled, entry["topK"]), self.run_case(entry)
                )

    def test_scaling_the_query_never_changes_the_scores(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                bigger = [x * 5 for x in entry["query"]]
                self.assertEqual(
                    self.nearest(bigger, FIXTURE["vectors"], entry["topK"]),
                    self.run_case(entry),
                )

    def test_every_score_is_inside_the_cosine_range(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for hit in self.run_case(entry):
                    self.assertGreaterEqual(hit["bps"], -10000)
                    self.assertLessEqual(hit["bps"], 10000)

    def test_a_zero_vector_never_appears_in_any_result(self):
        zeros = {v["id"] for v in FIXTURE["vectors"] if all(x == 0 for x in v["v"])}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for hit in self.run_case(entry):
                    self.assertNotIn(hit["id"], zeros)

    def test_results_are_ordered_by_descending_score(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                hits = self.run_case(entry)
                for earlier, later in zip(hits, hits[1:]):
                    self.assertGreaterEqual(earlier["bps"], later["bps"])
