import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("fresh-goes-to-cache", "a recent index answers the question"),
    ("stale-goes-live", "an old index does not"),
    ("exactly-at-the-boundary-goes-live", "the boundary is exclusive"),
    ("one-millisecond-inside-the-boundary-goes-to-cache", "one millisecond under is still fresh"),
    ("no-cache-entry-goes-live", "nothing cached is not accidentally fresh"),
    ("a-max-age-of-zero-always-goes-live", "a zero window disables the cache"),
    ("a-clock-skewed-future-entry-is-fresh", "a forward-skewed clock is not infinitely stale"),
)


class FreshnessRouting(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_case(self, entry: dict) -> str:
        return self.route(entry["cachedAt"], FIXTURE["now"], entry["maxAge"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["route"])

    def test_the_route_is_always_one_of_the_two(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertIn(self.run_case(entry), ("cache", "live"))

    def test_routing_is_monotone_in_age(self):
        for entry in FIXTURE["cases"]:
            if entry["cachedAt"] is None or self.run_case(entry) != "live":
                continue
            with self.subTest(entry["id"]):
                older = self.route(entry["cachedAt"] - 1, FIXTURE["now"], entry["maxAge"])
                self.assertEqual(older, "live")
