import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CATALOGUE = FIXTURE["catalogue"]
PROFILES = FIXTURE["profiles"]
CONFIG = FIXTURE["config"]

CASES = (
    ("a-profile-is-chosen-once-and-held-for-the-whole-run", "the prefix survives the run"),
    (
        "selecting-per-request-turns-every-step-into-a-cache-miss",
        "saved schemas, paid for everything else",
    ),
    ("a-tool-that-is-not-loaded-cannot-be-called", "selection is a blast-radius control"),
    ("an-addition-at-the-end-does-not-cost-the-cache", "surfaced, not swapped"),
    ("a-substitution-at-the-front-costs-everything-behind-it", "position zero changed"),
    ("shipping-every-tool-loads-the-one-that-moves-money", "the union of everything"),
    (
        "an-unknown-category-falls-back-without-loading-a-write-tool",
        "a fallback that cannot spend",
    ),
)


class DynamicSelection(unittest.TestCase):
    def setUp(self):
        self.select = load_impl(__file__).select

    @staticmethod
    def config_of(entry: dict) -> dict:
        return entry.get("config", CONFIG)

    def go(self, entry: dict, config: dict = None, run: dict = None) -> dict:
        return self.select(
            entry["run"] if run is None else run,
            PROFILES,
            CATALOGUE,
            config or self.config_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_refused_call_is_never_offered_or_used(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for tool in outcome["refused"]:
                    self.assertNotIn(tool, outcome["offered"])
                    self.assertNotIn(tool, outcome["used"])
                for tool in outcome["used"]:
                    self.assertIn(tool, outcome["offered"])

    def test_a_write_tool_is_callable_only_when_the_profile_names_it(self):
        for entry in FIXTURE["cases"]:
            asked = any(
                "issue_credit" in step["calls"] for step in entry["run"]["steps"]
            )
            if not asked:
                continue
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                loaded = "issue_credit" in outcome["offered"]
                self.assertEqual("issue_credit" in outcome["used"], loaded)
                self.assertEqual("issue_credit" in outcome["refused"], not loaded)

    def test_offered_and_used_partition_into_dead_weight(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["neverCalled"],
                    [t for t in outcome["offered"] if t not in outcome["used"]],
                )
                self.assertEqual(len(set(outcome["offered"])), len(outcome["offered"]))

    def test_holding_one_profile_keeps_every_later_step_on_a_cache_hit(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(
                    entry, {**self.config_of(entry), "selectPerRequest": False}
                )
                self.assertFalse(outcome["steps"][0]["cached"])
                for step in outcome["steps"][1:]:
                    self.assertTrue(step["cached"])

    def test_the_prefix_is_identical_at_every_step_unless_reselected(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(
                    entry, {**self.config_of(entry), "selectPerRequest": False}
                )
                first = outcome["steps"][0]["prefixTokens"]
                for step in outcome["steps"]:
                    self.assertEqual(step["prefixTokens"], first)

    def test_a_step_is_a_hit_exactly_when_its_prefix_matches_the_one_before(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                steps = self.go(entry)["steps"]
                for index, step in enumerate(steps):
                    owed = (
                        index > 0
                        and steps[index - 1]["prefixTokens"] == step["prefixTokens"]
                    )
                    self.assertEqual(step["cached"], owed)

    def test_an_addition_never_changes_the_prefix_it_lands_behind(self):
        entry = case(FIXTURE, "an-addition-at-the-end-does-not-cost-the-cache")
        stripped = {
            **entry["run"],
            "steps": [{**step, "additions": []} for step in entry["run"]["steps"]],
        }
        without = self.go(entry, None, stripped)
        with_ = self.go(entry)
        self.assertEqual(
            [s["prefixTokens"] for s in with_["steps"]],
            [s["prefixTokens"] for s in without["steps"]],
        )
        self.assertEqual(
            [s["cached"] for s in with_["steps"]],
            [s["cached"] for s in without["steps"]],
        )
        self.assertGreater(len(with_["offered"]), len(without["offered"]))

    def test_an_addition_adds_its_own_schema_cost_to_its_step(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for index, step in enumerate(outcome["steps"]):
                    source = entry["run"]["steps"][index]
                    owed = sum(
                        CATALOGUE["tools"][tool] for tool in source["additions"]
                    )
                    self.assertEqual(
                        step["variableTokens"], source["variableTokens"] + owed
                    )

    def test_an_unrecognised_category_gets_the_default_profile(self):
        entry = case(FIXTURE, "a-profile-is-chosen-once-and-held-for-the-whole-run")
        unknown = {**entry["run"], "category": "no_such_category"}
        outcome = self.go(
            entry, {**self.config_of(entry), "selectPerRequest": False}, unknown
        )
        self.assertEqual(outcome["offered"], PROFILES["default"]["tools"])
        self.assertEqual(outcome["namespace"], PROFILES["default"]["namespace"])
        for step in outcome["steps"]:
            self.assertEqual(
                step["prefixTokens"],
                CATALOGUE["systemTokens"] + CATALOGUE["tools"]["escalate_to_human"],
            )

    def test_reselecting_per_request_never_bills_less_than_holding(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                held = self.go(entry, {**self.config_of(entry), "selectPerRequest": False})
                churned = self.go(
                    entry, {**self.config_of(entry), "selectPerRequest": True}
                )
                self.assertGreaterEqual(churned["billedTokens"], held["billedTokens"])

    def test_the_bill_is_computed_from_the_prefix(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                bps = self.config_of(entry)["cacheReadBps"]
                outcome = self.go(entry)
                owed = 0
                for step in outcome["steps"]:
                    prefix = (
                        int(step["prefixTokens"] * bps / 10000 + 0.5)
                        if step["cached"]
                        else step["prefixTokens"]
                    )
                    self.assertEqual(
                        step["billedTokens"], prefix + step["variableTokens"]
                    )
                    owed += step["billedTokens"]
                self.assertEqual(outcome["billedTokens"], owed)

    def test_a_hit_never_bills_full_price(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.go(entry)["steps"]:
                    if not step["cached"]:
                        continue
                    self.assertLess(
                        step["billedTokens"],
                        step["prefixTokens"] + step["variableTokens"],
                    )
