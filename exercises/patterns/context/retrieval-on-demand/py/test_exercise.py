import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-statement-never-touches-the-corpus", "a turn that asks nothing retrieves nothing"),
    ("one-request-one-fetch", "a request reaches the index exactly once"),
    ("a-repeated-request-fetches-once", "the second identical request is served from cache"),
    ("distinct-requests-each-fetch", "different queries each cost a fetch"),
    ("a-miss-is-still-a-fetch-and-is-still-cached", "a miss is cached as a miss, not retried"),
    ("statements-between-requests-do-not-refetch", "a statement does not evict the cache"),
)


class RetrievalOnDemand(unittest.TestCase):
    def setUp(self):
        self.run = load_impl(__file__).run

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run(entry["turns"], FIXTURE["corpus"]), entry["result"])

    def test_one_result_per_turn(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run(entry["turns"], FIXTURE["corpus"])
                self.assertEqual(len(result["results"]), len(entry["turns"]))

    def test_fetches_never_repeat_a_query(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                fetches = self.run(entry["turns"], FIXTURE["corpus"])["fetches"]
                self.assertEqual(len(set(fetches)), len(fetches))

    def test_nothing_is_fetched_that_was_never_asked_for(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                asked = {turn["ask"] for turn in entry["turns"] if "ask" in turn}
                for query in self.run(entry["turns"], FIXTURE["corpus"])["fetches"]:
                    self.assertIn(query, asked)
