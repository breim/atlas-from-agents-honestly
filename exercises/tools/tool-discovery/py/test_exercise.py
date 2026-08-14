import re
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    (
        "a-query-that-matches-nothing-loads-nothing",
        "an empty search costs only the round trip",
    ),
    ("matching-tools-are-loaded-strongest-first", "the best match arrives first"),
    (
        "the-limit-drops-the-weakest-match-not-the-last-one",
        "the cap is a ranking, not a truncation",
    ),
    (
        "a-generous-limit-is-not-padded-with-non-matches",
        "spare room is not a reason to spend it",
    ),
    (
        "a-namespace-prefix-alone-finds-the-server",
        "the prefix is what makes the index searchable",
    ),
    (
        "a-resident-tool-is-never-loaded-a-second-time",
        "what is already there is not reloaded",
    ),
    (
        "a-catalogue-that-defers-everything-is-rejected",
        "an invisible agent has nothing to reason from",
    ),
    (
        "a-search-tool-with-nothing-visible-is-rejected",
        "searching implies something worth finding",
    ),
)


class ToolDiscovery(unittest.TestCase):
    def setUp(self):
        self.assemble = load_impl(__file__).assemble

    def catalogue_for(self, entry: dict) -> list:
        return FIXTURE[entry.get("catalogue", "catalogue")]

    def run_case(self, entry: dict) -> dict:
        return self.assemble(self.catalogue_for(entry), entry["query"], entry["limit"])

    def accepted(self) -> list:
        return [entry for entry in FIXTURE["cases"] if self.run_case(entry)["ok"]]

    @staticmethod
    def words(query: str) -> set:
        return {word for word in re.split(r"[^a-z0-9]+", query.lower()) if word}

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_resident_prefix_is_identical_for_every_query(self):
        results = [self.run_case(entry) for entry in self.accepted()]
        for result in results:
            self.assertEqual(result["resident"], results[0]["resident"])
            self.assertEqual(result["prefixTokens"], results[0]["prefixTokens"])

    def test_a_resident_tool_is_never_appended_as_well(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for name in result["appended"]:
                    self.assertNotIn(name, result["resident"])

    def test_the_number_of_appended_tools_never_exceeds_the_limit(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                self.assertLessEqual(
                    len(self.run_case(entry)["appended"]), entry["limit"]
                )

    def test_every_appended_tool_shares_a_word_with_the_query(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                query = self.words(entry["query"])
                catalogue = {t["name"]: t for t in self.catalogue_for(entry)}
                for name in self.run_case(entry)["appended"]:
                    self.assertIn(name, catalogue)
                    overlap = [k for k in catalogue[name]["keywords"] if k in query]
                    self.assertTrue(overlap, f"loaded {name}, which the query never asked for")

    def test_the_token_count_covers_exactly_the_resident_and_appended_tools(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                loaded = result["resident"] + result["appended"]
                cost = sum(
                    t["tokens"] for t in self.catalogue_for(entry) if t["name"] in loaded
                )
                self.assertEqual(result["totalTokens"], cost)

    def test_raising_the_limit_only_appends_more_and_appends_it_at_the_end(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                catalogue = self.catalogue_for(entry)
                tighter = self.assemble(catalogue, entry["query"], entry["limit"])["appended"]
                looser = self.assemble(catalogue, entry["query"], entry["limit"] + 1)["appended"]
                self.assertGreaterEqual(len(looser), len(tighter))
                self.assertEqual(looser[: len(tighter)], tighter)

    def test_a_catalogue_with_nothing_resident_is_rejected_whatever_the_query(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.assemble(
                    FIXTURE["deferredOnly"], entry["query"], entry["limit"]
                )
                self.assertFalse(result["ok"])
