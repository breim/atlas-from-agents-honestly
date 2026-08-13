import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("filters-by-tenant", "another tenant's chunk is not a result"),
    ("the-highest-scoring-chunk-can-be-filtered-out", "similarity does not outrank permission"),
    ("every-required-tag-must-be-present", "a partial tag match is not a match"),
    ("topk-applies-after-filtering", "the cap counts survivors, not candidates"),
    ("an-empty-tag-requirement-matches-everything", "no required tags is not no results"),
    ("nothing-matches", "an empty result is a result"),
    ("ties-break-on-id", "equal scores resolve the same way every run"),
)


class FilteredRetrieval(unittest.TestCase):
    def setUp(self):
        self.search = load_impl(__file__).search

    def run_case(self, entry: dict) -> list:
        return self.search(entry["chunks"], entry["filter"], entry["topK"])

    def survivors(self, entry: dict) -> list:
        return [
            chunk
            for chunk in entry["chunks"]
            if chunk["tenantId"] == entry["filter"]["tenantId"]
            and all(tag in chunk["tags"] for tag in entry["filter"]["requireTags"])
        ]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["hits"])

    def test_no_chunk_outside_the_filter_ever_appears(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_id = {chunk["id"]: chunk for chunk in entry["chunks"]}
                for doc_id in self.run_case(entry):
                    chunk = by_id[doc_id]
                    self.assertEqual(chunk["tenantId"], entry["filter"]["tenantId"])
                    for tag in entry["filter"]["requireTags"]:
                        self.assertIn(tag, chunk["tags"])

    def test_the_result_never_exceeds_topk(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(self.run_case(entry)), entry["topK"])

    def test_a_chunk_is_dropped_for_metadata_never_for_score(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    len(self.run_case(entry)),
                    min(len(self.survivors(entry)), entry["topK"]),
                )
