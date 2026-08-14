import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
PRICES = FIXTURE["prices"]

CASES = (
    ("a-call-is-priced-from-the-table-it-recorded", "the meter is built at the gateway"),
    ("cached-input-is-a-different-meter", "the same thousand tokens, a third of the price"),
    ("a-retry-costs-full-price", "a reliability problem on the cost dashboard"),
    ("eval-traffic-is-its-own-bucket", "a colleague running the suite twice"),
    (
        "the-mean-would-have-said-nothing-was-wrong",
        "p50 and p90 are fine; one run took 89%",
    ),
    ("a-repriced-table-does-not-move-an-old-call", "same tokens, different recorded price"),
    (
        "a-gap-means-traffic-that-never-reached-the-gateway",
        "an unmetered path is a control blind spot",
    ),
    ("a-two-percent-gap-still-reconciles", "reconciliation is a tolerance"),
    ("no-calls-reconcile-with-no-invoice", "nothing spent, nothing owed"),
)


def price_of(call: dict, prices: dict) -> int:
    rates = prices[call["priceVersion"]][call["model"]]
    return (
        call["inputTokens"] * rates["input"]
        + call["cachedInputTokens"] * rates["cachedInput"]
        + call["outputTokens"] * rates["output"]
    )


class CostAccounting(unittest.TestCase):
    def setUp(self):
        self.account = load_impl(__file__).account

    def run_case(self, entry: dict, prices: dict = None) -> dict:
        return self.account(entry["calls"], prices or PRICES, entry["invoice"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_three_buckets_account_for_every_micro(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                totals = self.run_case(entry)["totals"]
                self.assertEqual(
                    totals["productive"] + totals["unproductive"] + totals["synthetic"],
                    totals["total"],
                )

    def test_every_call_is_priced_by_the_version_it_recorded(self):
        for entry in FIXTURE["cases"]:
            priced = self.run_case(entry)["priced"]
            for index, call in enumerate(entry["calls"]):
                with self.subTest(f"{entry['id']}:{call['id']}"):
                    self.assertEqual(
                        priced[index],
                        {"id": call["id"], "costMicros": price_of(call, PRICES)},
                    )

    def test_adding_a_new_price_version_never_moves_a_recorded_cost(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                inflated = {
                    **PRICES,
                    "2027-01": {
                        "atlas-1": {"input": 9000, "cachedInput": 900, "output": 45000},
                        "atlas-mini": {"input": 1, "cachedInput": 1, "output": 1},
                    },
                }
                self.assertEqual(
                    self.run_case(entry, inflated), self.run_case(entry)
                )

    def test_moving_a_token_from_input_to_cache_never_costs_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                warmed = [
                    {
                        **call,
                        "inputTokens": 0,
                        "cachedInputTokens": call["cachedInputTokens"]
                        + call["inputTokens"],
                    }
                    for call in entry["calls"]
                ]
                before = self.run_case(entry)["totals"]["total"]
                after = self.account(warmed, PRICES, entry["invoice"])["totals"]["total"]
                self.assertLessEqual(after, before)

    def test_the_cache_hit_rate_ignores_synthetic_traffic(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                real = [c for c in entry["calls"] if not c["synthetic"]]
                cached = sum(c["cachedInputTokens"] for c in real)
                uncached = sum(c["inputTokens"] for c in real)
                share = (
                    0
                    if cached + uncached == 0
                    else floor(cached * 10000 / (cached + uncached) + 0.5)
                )
                self.assertEqual(self.run_case(entry)["cacheHitBps"], share)

    def test_the_percentiles_never_go_backwards(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                d = self.run_case(entry)["runCostMicros"]
                if d["p50"] is None:
                    self.assertEqual(
                        [d["p90"], d["p99"], d["max"]], [None, None, None]
                    )
                    continue
                self.assertLessEqual(d["p50"], d["p90"])
                self.assertLessEqual(d["p90"], d["p99"])
                self.assertLessEqual(d["p99"], d["max"])

    def test_the_distribution_is_over_runs_not_calls(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                real = [c for c in entry["calls"] if not c["synthetic"]]
                spend = sum(price_of(call, PRICES) for call in real)
                largest = self.run_case(entry)["runCostMicros"]["max"]
                if largest is None:
                    continue
                self.assertLessEqual(largest, spend)
                if len({call["runId"] for call in real}) == 1:
                    self.assertEqual(largest, spend)

    def test_synthetic_runs_never_enter_the_distribution(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                without = [c for c in entry["calls"] if not c["synthetic"]]
                stripped = self.account(without, PRICES, entry["invoice"])
                full = self.run_case(entry)
                self.assertEqual(stripped["runCostMicros"], full["runCostMicros"])
                self.assertEqual(stripped["topRunsShareBps"], full["topRunsShareBps"])

    def test_reconciliation_is_exactly_the_gap_against_the_tolerance(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                reconciliation = result["reconciliation"]
                self.assertEqual(
                    reconciliation["recordedMicros"], result["totals"]["total"]
                )
                self.assertEqual(
                    reconciliation["reconciles"],
                    reconciliation["gapBps"] <= entry["invoice"]["toleranceBps"],
                )
