import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = FIXTURE["policy"]

CASES = (
    ("the-baseline-samples-a-fixed-share", "a slice of everything"),
    (
        "every-escalation-is-scored-whatever-the-baseline-says",
        "oversample where failures live",
    ),
    ("a-run-can-match-more-than-one-stratum", "two reasons, one score"),
    ("a-flagged-run-that-is-also-a-baseline-hit-is-scored-once", "no double counting"),
    ("shadow-cannot-validate-a-write", "nothing happened, so nothing was proved"),
    ("canary-is-what-validates-the-write-path", "real consequences, small blast radius"),
    ("a-mixed-rollout-reports-the-gap", "half the writes are still unproven"),
    ("no-traffic-scores-nothing", "no runs, no plan"),
)


def flagged(run: dict) -> bool:
    return any(run[name] for name in POLICY["always"])


class OnlineEvals(unittest.TestCase):
    def setUp(self):
        self.plan = load_impl(__file__).plan

    def run_runs(self, runs: list, policy: dict = None) -> dict:
        return self.plan(runs, policy or POLICY)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_runs(entry["runs"]), entry["result"])

    def test_every_run_matching_a_stratum_is_scored(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                scored = self.run_runs(entry["runs"])["scored"]
                for run in entry["runs"]:
                    if flagged(run):
                        self.assertIn(run["id"], scored)

    def test_the_scored_list_has_no_duplicates_and_keeps_the_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                scored = self.run_runs(entry["runs"])["scored"]
                self.assertEqual(len(set(scored)), len(scored))
                order = [r["id"] for r in entry["runs"] if r["id"] in set(scored)]
                self.assertEqual(scored, order)

    def test_nothing_is_scored_that_was_not_in_the_traffic(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ids = {run["id"] for run in entry["runs"]}
                for scored_id in self.run_runs(entry["runs"])["scored"]:
                    self.assertIn(scored_id, ids)

    def test_a_failure_stratum_is_never_sampled_less_than_plain_traffic(self):
        for entry in FIXTURE["cases"]:
            rates = self.run_runs(entry["runs"])["rateBps"]
            for name in POLICY["always"]:
                if not any(run[name] for run in entry["runs"]):
                    continue
                with self.subTest(f"{entry['id']}:{name}"):
                    self.assertGreaterEqual(rates[name], rates["plain"])

    def test_a_shadow_write_is_always_reported_as_unproven(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                writes = self.run_runs(entry["runs"])["writes"]
                for run in entry["runs"]:
                    unproven = run["requestsWrite"] and run["stage"] == "shadow"
                    self.assertEqual(run["id"] in writes["unvalidated"], unproven)

    def test_the_write_accounting_covers_every_request_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                writes = self.run_runs(entry["runs"])["writes"]
                requested = sum(1 for run in entry["runs"] if run["requestsWrite"])
                self.assertEqual(writes["requested"], requested)
                self.assertEqual(
                    writes["validated"] + len(writes["unvalidated"]), requested
                )
                self.assertEqual(
                    writes["coverageBps"],
                    0
                    if requested == 0
                    else floor(writes["validated"] * 10000 / requested + 0.5),
                )

    def test_promoting_shadow_traffic_to_canary_closes_the_write_gap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                promoted = [{**run, "stage": "canary"} for run in entry["runs"]]
                writes = self.run_runs(promoted)["writes"]
                self.assertEqual(writes["unvalidated"], [])
                self.assertEqual(
                    writes["coverageBps"], 0 if writes["requested"] == 0 else 10000
                )

    def test_sampling_everything_scores_everything(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_runs(entry["runs"], {**POLICY, "baselineEveryNth": 1})
                self.assertEqual(
                    result["scored"], [run["id"] for run in entry["runs"]]
                )
                self.assertEqual(
                    result["rateBps"]["overall"], 0 if not entry["runs"] else 10000
                )

    def test_a_sparser_baseline_never_scores_more_runs(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                sparser = self.run_runs(
                    entry["runs"],
                    {**POLICY, "baselineEveryNth": POLICY["baselineEveryNth"] * 100},
                )
                self.assertLessEqual(
                    len(sparser["scored"]),
                    len(self.run_runs(entry["runs"])["scored"]),
                )
