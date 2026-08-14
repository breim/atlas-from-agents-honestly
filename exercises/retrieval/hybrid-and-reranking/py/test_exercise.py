import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("hybrid-finds-what-neither-retriever-found-alone", "fusion earns its cost"),
    ("hybrid-matches-the-better-retriever-and-buys-nothing", "parity is not an improvement"),
    ("hybrid-loses-to-the-better-retriever", "fusion can make retrieval worse"),
    ("each-retriever-finds-a-different-half", "disjoint failures are what hybrid is for"),
    ("a-relevant-document-past-the-cut-helps-nobody", "k applies to every run alike"),
    ("all-three-retrievers-fail-together", "shared failures gain nothing"),
    ("a-query-with-no-relevant-documents-proves-nothing", "a run everything passes proves nothing"),
)


class HybridAndReranking(unittest.TestCase):
    def setUp(self):
        self.compare = load_impl(__file__).compare

    def run_case(self, entry: dict) -> dict:
        return self.compare(entry["runs"], entry["relevant"], FIXTURE["k"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_recall_is_a_valid_rate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for key in ("semanticBps", "lexicalBps", "hybridBps"):
                    self.assertGreaterEqual(result[key], 0)
                    self.assertLessEqual(result[key], 10000)

    def test_the_verdict_compares_against_the_better_single_retriever(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                best = max(result["semanticBps"], result["lexicalBps"])
                if result["hybridBps"] > best:
                    label = "gain"
                elif result["hybridBps"] == best:
                    label = "no_gain"
                else:
                    label = "regression"
                self.assertEqual(result["verdict"], label)

    def test_swapping_the_single_retrievers_never_changes_the_verdict(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                swapped = {
                    **entry["runs"],
                    "semantic": entry["runs"]["lexical"],
                    "lexical": entry["runs"]["semantic"],
                }
                verdict = self.compare(swapped, entry["relevant"], FIXTURE["k"])["verdict"]
                self.assertEqual(verdict, self.run_case(entry)["verdict"])

    def test_nothing_past_the_cut_counts_for_any_run(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                trimmed = {
                    name: run[: FIXTURE["k"]] for name, run in entry["runs"].items()
                }
                self.assertEqual(
                    self.compare(trimmed, entry["relevant"], FIXTURE["k"]),
                    self.run_case(entry),
                )

    def test_a_maximal_hybrid_run_is_never_a_regression(self):
        for entry in FIXTURE["cases"]:
            if not entry["relevant"]:
                continue
            with self.subTest(entry["id"]):
                perfect = {**entry["runs"], "hybrid": entry["relevant"][: FIXTURE["k"]]}
                verdict = self.compare(perfect, entry["relevant"], FIXTURE["k"])["verdict"]
                self.assertNotEqual(verdict, "regression")
