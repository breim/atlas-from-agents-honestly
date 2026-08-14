import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
PRIORITIES = ("interactive", "background", "batch")

CASES = (
    ("an-interactive-run-with-headroom-is-admitted", "the ordinary path"),
    ("a-batch-job-cannot-cross-the-interactive-floor", "the 2am incident, prevented"),
    (
        "a-saturated-batch-share-does-not-touch-interactive",
        "the floor holds under batch load",
    ),
    ("retries-count-against-the-same-quota", "they bypass the door otherwise"),
    (
        "one-tenant-burst-cannot-starve-the-others",
        "the class had room; the tenant did not",
    ),
    ("the-class-budget-is-checked-before-the-tenant-cap", "the check order is fixed"),
    ("a-run-exactly-at-the-budget-is-admitted", "the boundary is inclusive"),
    ("one-token-over-is-refused", "and one over it is not"),
    ("a-longer-run-lowers-the-ceiling-further", "one run against two million tokens"),
    ("a-tenant-nobody-has-seen-starts-from-zero", "an absent tenant is not a full one"),
)


class Backpressure(unittest.TestCase):
    def setUp(self):
        self.admit = load_impl(__file__).admit

    @staticmethod
    def config_for(entry: dict, **overrides) -> dict:
        config = dict(CONFIG)
        if "profile" in entry:
            config["profile"] = entry["profile"]
        config.update(overrides)
        return config

    def run_case(self, entry: dict, request: dict = None, used: dict = None, **overrides) -> dict:
        return self.admit(
            request or entry["run"],
            used or entry["used"],
            self.config_for(entry, **overrides),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_class_shares_never_over_allocate_the_effective_quota(self):
        effective = floor(CONFIG["inputTpm"] * CONFIG["clientLimitBps"] / 10000)
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                budgets = [
                    self.run_case(entry, {**entry["run"], "priority": priority})["classBudget"]
                    for priority in PRIORITIES
                ]
                self.assertLessEqual(sum(budgets), effective)
                self.assertLessEqual(effective, CONFIG["inputTpm"])

    def test_a_refusal_says_when_to_come_back_and_an_admission_never_waits(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["admitted"], result["reason"] is None)
                if result["admitted"]:
                    self.assertEqual(result["retryAfterMs"], 0)
                else:
                    self.assertGreater(result["retryAfterMs"], 0)

    def test_headroom_is_what_the_class_has_left(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                priority = entry["run"]["priority"]
                spent = (
                    entry["used"]["byPriority"][priority]
                    + entry["used"]["retriesByPriority"][priority]
                )
                self.assertEqual(result["headroom"], result["classBudget"] - spent)

    def test_forgetting_the_retries_would_have_admitted_too_much(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                honest = self.run_case(entry)
                blind = {
                    **entry["used"],
                    "retriesByPriority": {p: 0 for p in PRIORITIES},
                }
                optimistic = self.run_case(entry, used=blind)
                self.assertGreaterEqual(optimistic["headroom"], honest["headroom"])
                if honest["admitted"]:
                    self.assertTrue(optimistic["admitted"])

    def test_saturating_every_other_class_never_changes_interactive(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                request = {**entry["run"], "priority": "interactive"}
                quiet = self.run_case(entry, request)
                busy = self.run_case(
                    entry,
                    request,
                    {
                        **entry["used"],
                        "byPriority": {
                            **entry["used"]["byPriority"],
                            "background": 100_000_000,
                            "batch": 100_000_000,
                        },
                    },
                )
                self.assertEqual(busy, quiet)

    def test_a_tenant_that_has_spent_more_is_never_admitted_more_easily(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                heavier = self.run_case(
                    entry,
                    used={
                        **entry["used"],
                        "byTenant": {
                            **entry["used"]["byTenant"],
                            entry["run"]["tenantId"]: 100_000_000,
                        },
                    },
                )
                self.assertFalse(heavier["admitted"])

    def test_a_bigger_estimate_is_never_admitted_more_easily(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)["admitted"]
                bigger = self.run_case(
                    entry,
                    {
                        **entry["run"],
                        "estInputTokens": entry["run"]["estInputTokens"] + 1_000_000,
                    },
                )
                self.assertTrue(not bigger["admitted"] or before)

    def test_the_ceiling_depends_on_the_profile_and_nothing_else(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                baseline = self.run_case(entry)["effectiveConcurrentRuns"]
                elsewhere = self.run_case(
                    entry,
                    {"priority": "batch", "tenantId": "someone-else", "estInputTokens": 1},
                    {
                        "byPriority": {p: 5 for p in PRIORITIES},
                        "retriesByPriority": {p: 5 for p in PRIORITIES},
                        "byTenant": {"someone-else": 5},
                    },
                )
                self.assertEqual(elsewhere["effectiveConcurrentRuns"], baseline)

    def test_a_heavier_workload_profile_never_raises_the_ceiling(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                profile = self.config_for(entry)["profile"]
                heavier = self.run_case(
                    entry,
                    profile={
                        **profile,
                        "turnsPerMinute": profile["turnsPerMinute"] * 2,
                    },
                )
                self.assertLessEqual(
                    heavier["effectiveConcurrentRuns"],
                    self.run_case(entry)["effectiveConcurrentRuns"],
                )
