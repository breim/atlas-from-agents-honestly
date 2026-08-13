import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("already-in-stable-order", "a prompt already in order is left alone"),
    ("moves-a-volatile-block-to-the-back", "a timestamp above the system prompt costs the prefix"),
    ("preserves-relative-order-within-each-group", "the sort is stable within both groups"),
    ("all-volatile-has-no-cacheable-prefix", "nothing stable means nothing cached"),
    ("all-stable-caches-everything", "nothing volatile means the whole prompt caches"),
    ("an-empty-prompt-caches-nothing", "an empty prompt is zero, not a crash"),
)


class StablePrefix(unittest.TestCase):
    def setUp(self):
        self.order = load_impl(__file__).order

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.order(entry["blocks"]), entry["result"])

    def test_every_stable_block_precedes_every_volatile_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_id = {block["id"]: block for block in entry["blocks"]}
                volatility = [by_id[id_]["volatile"] for id_ in self.order(entry["blocks"])["ordered"]]
                if True not in volatility:
                    continue
                self.assertTrue(all(volatility[volatility.index(True) :]))

    def test_the_ordering_is_a_permutation_not_a_filter(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    sorted(self.order(entry["blocks"])["ordered"]),
                    sorted(block["id"] for block in entry["blocks"]),
                )

    def test_prefix_tokens_counts_exactly_the_stable_blocks(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                stable = sum(b["tokens"] for b in entry["blocks"] if not b["volatile"])
                self.assertEqual(self.order(entry["blocks"])["prefixTokens"], stable)
