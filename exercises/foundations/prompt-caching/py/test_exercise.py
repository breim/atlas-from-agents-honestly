import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-first-request-always-misses", "a cold cache cannot hit"),
    ("an-identical-prefix-hits", "the same prefix twice hits"),
    ("a-prefix-below-the-floor-is-never-cached", "small prompts get no caching at all"),
    ("exactly-at-the-floor-is-cached", "the minimum is inclusive"),
    ("a-changed-prefix-misses-and-becomes-the-new-entry", "a prompt change costs one request"),
    ("an-idle-entry-expires", "a quiet prefix falls out"),
    ("exactly-at-the-ttl-is-expired", "the TTL comparison is strict"),
    ("traffic-keeps-an-entry-alive-past-its-ttl", "the TTL measures idle time, not age"),
    ("no-requests-have-no-rate", "no traffic is a rate of zero"),
)


class PromptCaching(unittest.TestCase):
    def setUp(self):
        self.replay = load_impl(__file__).replay

    def run_case(self, entry: dict) -> dict:
        return self.replay(entry["requests"], FIXTURE["minCacheTokens"], FIXTURE["ttlMs"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_request_is_a_hit_or_a_miss(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["hits"] + result["misses"]), list(range(len(entry["requests"])))
                )

    def test_the_first_request_is_never_a_hit(self):
        for entry in FIXTURE["cases"]:
            if not entry["requests"]:
                continue
            with self.subTest(entry["id"]):
                self.assertNotIn(0, self.run_case(entry)["hits"])

    def test_nothing_below_the_token_floor_ever_hits(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for index in self.run_case(entry)["hits"]:
                    self.assertGreaterEqual(
                        entry["requests"][index]["prefixTokens"], FIXTURE["minCacheTokens"]
                    )

    def test_a_hit_always_follows_the_same_prefix(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for index in self.run_case(entry)["hits"]:
                    self.assertEqual(
                        entry["requests"][index - 1]["prefix"],
                        entry["requests"][index]["prefix"],
                    )

    def test_the_rate_matches_the_hits(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if not entry["requests"]:
                    rate = 0
                else:
                    rate = math.floor(
                        len(result["hits"]) * 10000 / len(entry["requests"]) + 0.5
                    )
                self.assertEqual(result["hitRateBps"], rate)
