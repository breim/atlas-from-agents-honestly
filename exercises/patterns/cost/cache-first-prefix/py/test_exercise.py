import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-cold-request-pays-to-write-the-whole-cache", "a first request caches nothing"),
    ("an-identical-request-reads-everything-from-cache", "a repeat request is cheap"),
    ("appending-only-pays-for-what-was-appended", "appending preserves the prefix"),
    ("changing-the-first-block-invalidates-everything", "the prefix breaks at the first difference"),
    ("a-tiny-change-at-the-front-costs-the-whole-suffix", "ten tokens can cost a thousand"),
    ("a-block-that-shrinks-breaks-the-prefix-there", "dropping a trailing block keeps the prefix"),
    ("an-empty-request-costs-nothing", "nothing sent is nothing billed"),
)


class CacheFirstPrefix(unittest.TestCase):
    def setUp(self):
        self.price = load_impl(__file__).price

    def run_case(self, entry: dict) -> dict:
        return self.price(entry["previous"], entry["current"], FIXTURE["pricing"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_cached_plus_fresh_is_the_whole_request(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                total = sum(block["tokens"] for block in entry["current"])
                self.assertEqual(result["cached"] + result["fresh"], total)

    def test_nothing_after_the_first_difference_is_cached(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shared = 0
                while (
                    shared < len(entry["current"])
                    and shared < len(entry["previous"])
                    and entry["previous"][shared] == entry["current"][shared]
                ):
                    shared += 1
                cacheable = sum(b["tokens"] for b in entry["current"][:shared])
                self.assertEqual(self.run_case(entry)["cached"], cacheable)

    def test_a_cache_hit_is_always_cheaper_than_paying_fresh(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["cached"] == 0:
                continue
            with self.subTest(entry["id"]):
                all_fresh = self.price([], entry["current"], FIXTURE["pricing"])["micros"]
                self.assertLess(result["micros"], all_fresh)

    def test_breaking_the_prefix_at_the_front_never_costs_less(self):
        for entry in FIXTURE["cases"]:
            if len(entry["current"]) < 2:
                continue
            with self.subTest(entry["id"]):
                broken = [{**entry["current"][0], "hash": "BROKEN"}, *entry["current"][1:]]
                cost = self.price(entry["previous"], broken, FIXTURE["pricing"])["micros"]
                self.assertGreaterEqual(cost, self.run_case(entry)["micros"])
