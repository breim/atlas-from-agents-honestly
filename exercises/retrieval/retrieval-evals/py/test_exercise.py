import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-perfect-ranking-scores-everything", "everything relevant, nothing else, top first"),
    ("one-relevant-hit-at-the-top", "one hit first is full recall and full rank"),
    ("the-same-hit-lower-down-costs-reciprocal-rank-only", "position is invisible to recall"),
    ("a-relevant-document-outside-the-cut-is-not-recalled", "k is what the model will see"),
    ("partial-recall-and-partial-precision", "two of three, two ways"),
    ("a-short-result-list-is-scored-on-what-it-returned", "a short list is not punished"),
    ("nothing-relevant-scores-zero-across-the-board", "no hits is zero everywhere"),
    ("an-empty-result-list-scores-zero", "returning nothing scores nothing"),
    ("a-query-with-no-relevant-documents-recalls-vacuously", "full recall and no precision at once"),
)


class RetrievalEvals(unittest.TestCase):
    def setUp(self):
        self.score = load_impl(__file__).score

    def run_case(self, entry: dict) -> dict:
        return self.score(entry["retrieved"], entry["relevant"], FIXTURE["k"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_score_is_a_valid_rate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for value in self.run_case(entry).values():
                    self.assertGreaterEqual(value, 0)
                    self.assertLessEqual(value, 10000)

    def test_nothing_beyond_k_is_ever_counted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                cut = self.score(
                    entry["retrieved"][: FIXTURE["k"]], entry["relevant"], FIXTURE["k"]
                )
                self.assertEqual(cut, self.run_case(entry))

    def test_reciprocal_rank_is_zero_exactly_when_there_is_no_hit(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                top = entry["retrieved"][: FIXTURE["k"]]
                any_hit = any(doc in entry["relevant"] for doc in top)
                self.assertEqual(self.run_case(entry)["rrBps"] > 0, any_hit)

    def test_moving_the_first_hit_earlier_never_lowers_reciprocal_rank(self):
        for entry in FIXTURE["cases"]:
            before = self.run_case(entry)["rrBps"]
            if before == 0 or not entry["relevant"]:
                continue
            with self.subTest(entry["id"]):
                promoted = [entry["relevant"][0], *entry["retrieved"]]
                after = self.score(promoted, entry["relevant"], FIXTURE["k"])["rrBps"]
                self.assertGreaterEqual(after, before)

    def test_recall_and_precision_cannot_see_position(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shuffled = list(reversed(entry["retrieved"][: FIXTURE["k"]]))
                moved = self.score(shuffled, entry["relevant"], FIXTURE["k"])
                original = self.run_case(entry)
                self.assertEqual(moved["recallBps"], original["recallBps"])
                self.assertEqual(moved["precisionBps"], original["precisionBps"])
