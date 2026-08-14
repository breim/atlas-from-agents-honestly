import unittest
from math import ceil, floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = {
    "budgets": FIXTURE["budgets"],
    "baseline": FIXTURE["baseline"],
    "noiseBandBps": FIXTURE["noiseBandBps"],
}

CASES = (
    ("a-healthy-release-passes-all-three-gates", "right, cheap, and fast enough"),
    (
        "a-run-that-escalated-is-paid-for-and-bought-nothing",
        "per attempt says $0.20; per outcome says $1.00",
    ),
    (
        "an-expensive-release-that-works-costs-the-same-per-outcome",
        "the other half of the table",
    ),
    (
        "nothing-accepted-means-there-is-no-cost-per-outcome",
        "a denominator of zero is not a bargain",
    ),
    ("a-three-day-approval-is-not-latency", "waiting for a person is the system working"),
    ("a-fast-total-can-still-feel-broken", "time to first token is not a substitute"),
    ("p95-hides-the-tail-that-the-ceiling-catches", "the incident lives past the percentile"),
    ("a-cost-regression-fails-on-its-own", "quality alone would have shipped it"),
    (
        "quality-at-the-bottom-of-the-noise-band-still-passes",
        "noise is not a regression",
    ),
    ("quality-one-step-below-the-band-fails", "and a regression is not noise"),
    ("a-release-with-no-runs-has-nothing-to-gate", "nothing measured, nothing earned"),
)


class CostAndLatencyEvals(unittest.TestCase):
    def setUp(self):
        self.evaluate = load_impl(__file__).evaluate

    def run_runs(self, runs: list, **overrides) -> dict:
        return self.evaluate(runs, {**CONFIG, **overrides})

    @staticmethod
    def spend(runs: list) -> int:
        return sum(run["costCents"] for run in runs)

    @staticmethod
    def resolved(runs: list) -> int:
        return sum(1 for run in runs if run["outcome"] == "resolved")

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_runs(entry["runs"]), entry["result"])

    def test_every_cent_is_in_the_numerator_and_only_outcomes_below(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                accepted = self.resolved(entry["runs"])
                expected_cost = (
                    None
                    if accepted == 0
                    else floor(self.spend(entry["runs"]) / accepted + 0.5)
                )
                self.assertEqual(
                    self.run_runs(entry["runs"])["costPerOutcomeCents"], expected_cost
                )

    def test_a_failed_run_raises_cost_per_outcome_and_never_lowers_it(self):
        for entry in FIXTURE["cases"]:
            before = self.run_runs(entry["runs"])["costPerOutcomeCents"]
            if before is None:
                continue
            with self.subTest(entry["id"]):
                failed = {
                    "outcome": "escalated",
                    "costCents": 50,
                    "ttftMs": 400,
                    "totalMs": 5000,
                    "humanWaitMs": 0,
                }
                after = self.run_runs(entry["runs"] + [failed])["costPerOutcomeCents"]
                self.assertGreaterEqual(after, before)

    def test_cost_per_attempt_never_exceeds_cost_per_outcome(self):
        for entry in FIXTURE["cases"]:
            result = self.run_runs(entry["runs"])
            if result["costPerAttemptCents"] is None or result["costPerOutcomeCents"] is None:
                continue
            with self.subTest(entry["id"]):
                self.assertLessEqual(
                    result["costPerAttemptCents"], result["costPerOutcomeCents"]
                )

    def test_human_wait_is_never_counted_as_latency(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                stalled = [
                    {
                        **run,
                        "totalMs": run["totalMs"] + 86_400_000,
                        "humanWaitMs": run["humanWaitMs"] + 86_400_000,
                    }
                    for run in entry["runs"]
                ]
                self.assertEqual(self.run_runs(stalled), self.run_runs(entry["runs"]))

    def test_the_percentile_is_the_nearest_rank_of_the_measured_times(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                measured = sorted(
                    run["totalMs"] - run["humanWaitMs"] for run in entry["runs"]
                )
                rank = (
                    None
                    if not measured
                    else measured[ceil(95 * len(measured) / 100) - 1]
                )
                self.assertEqual(self.run_runs(entry["runs"])["totalP95Ms"], rank)

    def test_a_release_passes_only_when_all_three_gates_do(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                gates = self.run_runs(entry["runs"])["gates"]
                self.assertEqual(
                    gates["pass"],
                    gates["quality"] and gates["cost"] and gates["latency"],
                )

    def test_a_run_over_the_hard_ceiling_shows_in_the_ceiling_share(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ceiling = FIXTURE["budgets"]["hardCeilingMs"]
                over = sum(
                    1
                    for run in entry["runs"]
                    if run["totalMs"] - run["humanWaitMs"] > ceiling
                )
                total = len(entry["runs"])
                share = 0 if total == 0 else floor(over * 10000 / total + 0.5)
                self.assertEqual(self.run_runs(entry["runs"])["overCeilingBps"], share)

    def test_a_stricter_noise_band_never_forgives_a_quality_failure(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_runs(entry["runs"])["gates"]["quality"]
                after = self.run_runs(entry["runs"], noiseBandBps=0)["gates"]["quality"]
                self.assertTrue(not after or before)

    def test_spending_more_per_run_never_improves_the_cost_gate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_runs(entry["runs"])["gates"]["cost"]
                pricier = [
                    {**run, "costCents": run["costCents"] * 3} for run in entry["runs"]
                ]
                self.assertTrue(not self.run_runs(pricier)["gates"]["cost"] or before)
