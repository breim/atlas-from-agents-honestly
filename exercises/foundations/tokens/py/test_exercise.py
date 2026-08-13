import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
RATES = ("input", "output", "cacheWrite", "cacheRead")


class Tokens(unittest.TestCase):
    def setUp(self):
        self.cost_micros = load_impl(__file__).cost_micros

    def cost(self, case_id: str) -> int:
        return self.cost_micros(case(FIXTURE, case_id)["usage"], FIXTURE["pricing"])

    def micros(self, case_id: str) -> int:
        return case(FIXTURE, case_id)["micros"]

    def test_uncached_bills_input_and_output_at_their_own_rates(self):
        self.assertEqual(self.cost("uncached"), self.micros("uncached"))

    def test_output_dominates_defeats_a_blended_rate(self):
        self.assertEqual(self.cost("output-dominates"), self.micros("output-dominates"))

    def test_cache_read_bills_at_a_tenth_of_an_input_token(self):
        self.assertEqual(self.cost("cache-read"), self.micros("cache-read"))

    def test_cache_write_bills_above_an_input_token(self):
        self.assertEqual(self.cost("cache-write"), self.micros("cache-write"))

    def test_halves_round_up_rather_than_to_even(self):
        self.assertEqual(self.cost("halves-round-up"), self.micros("halves-round-up"))

    def test_empty_usage_is_free(self):
        self.assertEqual(self.cost("empty"), self.micros("empty"))

    def test_every_rate_is_load_bearing(self):
        for rate in RATES:
            usage = dict.fromkeys(RATES, 0)
            usage[rate] = 1000
            self.assertEqual(
                self.cost_micros(usage, FIXTURE["pricing"]),
                math.floor(1000 * FIXTURE["pricing"][rate] + 0.5),
                f"{rate} is not being charged",
            )
