import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
PRICES = FIXTURE["prices"]
GENEROUS = {"capMicros": 10**12, "softRatioBps": 10000}

CASES = (
    (
        "a-four-turn-run-spends-most-of-it-re-reading-itself",
        "input volume is what multiplies",
    ),
    ("doubling-the-turns-more-than-doubles-the-bill", "the quadratic, measured"),
    ("compaction-caps-what-is-re-sent", "a context decision that is a cost decision"),
    ("the-soft-ratio-degrades-before-it-fails", "degrading bought a fifth turn"),
    ("without-degradation-the-run-stops-a-turn-sooner", "the same budget, less work"),
    (
        "a-cap-below-the-first-turn-stops-before-spending-anything",
        "a refused turn is not billed",
    ),
    ("a-run-with-no-turns-spends-nothing", "nothing to re-send"),
)


class CostEngineering(unittest.TestCase):
    def setUp(self):
        self.run_impl = load_impl(__file__).run

    @staticmethod
    def plan_of(entry: dict) -> dict:
        return entry.get("plan", FIXTURE["plan"])

    def execute(self, entry: dict, plan: dict = None, budget: dict = None) -> dict:
        return self.run_impl(
            plan or self.plan_of(entry), budget or entry["budget"], PRICES
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.execute(entry), entry["result"])

    def test_the_accounting_adds_up_both_ways(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.execute(entry)
                self.assertEqual(
                    result["inputMicros"] + result["outputMicros"],
                    result["spentMicros"],
                )
                self.assertEqual(
                    sum(turn["costMicros"] for turn in result["turns"]),
                    result["spentMicros"],
                )

    def test_a_run_never_spends_past_its_cap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(
                    self.execute(entry)["spentMicros"], entry["budget"]["capMicros"]
                )

    def test_a_refused_turn_is_not_recorded_and_not_billed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.execute(entry)
                max_turns = self.plan_of(entry)["maxTurns"]
                self.assertLessEqual(len(result["turns"]), max_turns)
                self.assertEqual(
                    result["outcome"] == "completed", len(result["turns"]) == max_turns
                )

    def test_the_context_grows_every_turn_until_compaction_caps_it(self):
        for entry in FIXTURE["cases"]:
            plan = self.plan_of(entry)
            for index, turn in enumerate(self.execute(entry)["turns"]):
                with self.subTest(f"{entry['id']}:{turn['index']}"):
                    grown = (
                        plan["systemTokens"]
                        + plan["toolsTokens"]
                        + index * plan["perTurnTokens"]
                    )
                    owed = (
                        min(grown, plan["compactionCap"])
                        if plan["compactionCap"] > 0
                        else grown
                    )
                    self.assertEqual(turn["contextTokens"], owed)

    def test_input_dominates_when_the_context_outweighs_the_reply(self):
        for entry in FIXTURE["cases"]:
            plan = self.plan_of(entry)
            result = self.execute(entry)
            if not result["turns"]:
                continue
            if plan["systemTokens"] + plan["toolsTokens"] <= plan["outputTokens"] * 5:
                continue
            with self.subTest(entry["id"]):
                self.assertGreater(result["inputMicros"], result["outputMicros"])

    def test_doubling_the_turns_more_than_doubles_the_input(self):
        for entry in FIXTURE["cases"]:
            plan = self.plan_of(entry)
            if plan["compactionCap"] > 0 or plan["perTurnTokens"] == 0 or plan["maxTurns"] == 0:
                continue
            with self.subTest(entry["id"]):
                half = self.execute(entry, plan, GENEROUS)["inputMicros"]
                full = self.execute(
                    entry, {**plan, "maxTurns": plan["maxTurns"] * 2}, GENEROUS
                )["inputMicros"]
                self.assertGreater(full, half * 2)

    def test_compaction_never_costs_more_for_the_same_turns(self):
        for entry in FIXTURE["cases"]:
            plan = self.plan_of(entry)
            if plan["maxTurns"] == 0:
                continue
            with self.subTest(entry["id"]):
                uncapped = self.execute(
                    entry, {**plan, "compactionCap": 0}, GENEROUS
                )["spentMicros"]
                capped = self.execute(
                    entry, {**plan, "compactionCap": plan["systemTokens"]}, GENEROUS
                )["spentMicros"]
                self.assertLessEqual(capped, uncapped)

    def test_degrading_earlier_never_buys_fewer_turns(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                eager = self.execute(
                    entry, budget={**entry["budget"], "softRatioBps": 0}
                )
                never = self.execute(
                    entry, budget={**entry["budget"], "softRatioBps": 10000}
                )
                self.assertGreaterEqual(len(eager["turns"]), len(never["turns"]))

    def test_a_bigger_cap_never_buys_fewer_turns(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = len(self.execute(entry)["turns"])
                richer = self.execute(
                    entry,
                    budget={
                        **entry["budget"],
                        "capMicros": entry["budget"]["capMicros"] * 10,
                    },
                )
                self.assertGreaterEqual(len(richer["turns"]), before)
