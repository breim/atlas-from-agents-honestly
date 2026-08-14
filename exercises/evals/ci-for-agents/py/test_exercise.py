import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-set-sized-for-the-regression-that-matters-is-sound", "derive the size"),
    ("twenty-cases-cannot-gate-anything-judged", "a coin flip with a changelog"),
    ("a-deterministic-assertion-gates-at-any-set-size", "no sampling error"),
    (
        "a-two-point-regression-is-not-detectable-by-anything-realistic",
        "that is information",
    ),
    ("an-ungated-criterion-is-reported-rather-than-refused", "gate what you can detect"),
    ("sixty-judged-gates-flake-by-construction", "three false alarms per run"),
    (
        "a-quality-claim-needs-production-settings-and-several-seeds",
        "a system nobody runs",
    ),
    ("the-quality-question-answered-properly", "two configurations"),
    ("an-undeclared-rerun-policy-is-p-hacking", "declared beforehand is a design"),
)


class CiForAgents(unittest.TestCase):
    def setUp(self):
        self.audit = load_impl(__file__).audit

    def go(self, entry, suite=None, question=None, policy=None):
        return self.audit(
            suite or entry["suite"],
            policy or entry["policy"],
            question or entry["question"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_the_detectable_effect_follows_the_set_size(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        table = sorted(
            ({"points": int(k), "needed": v} for k, v in entry["policy"]["detectableAt"].items()),
            key=lambda e: e["points"],
        )
        for step in table:
            with self.subTest(step["points"]):
                below = self.go(entry, {**entry["suite"], "casesPerArm": step["needed"] - 1})
                at = self.go(entry, {**entry["suite"], "casesPerArm": step["needed"]})
                self.assertIsNotNone(at["detectablePoints"])
                self.assertLessEqual(at["detectablePoints"], step["points"])
                if below["detectablePoints"] is not None:
                    self.assertGreater(
                        below["detectablePoints"], at["detectablePoints"]
                    )
        self.assertIsNone(
            self.go(entry, {**entry["suite"], "casesPerArm": 20})["detectablePoints"]
        )

    def test_a_judged_criterion_may_only_gate_on_a_visible_effect(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        detectable = self.go(entry)["detectablePoints"]
        for drop in (detectable - 1, detectable, detectable + 1):
            with self.subTest(drop):
                probe = self.go(
                    entry,
                    {
                        **entry["suite"],
                        "criteria": [
                            {
                                "name": "probe",
                                "kind": "judged",
                                "gated": True,
                                "observedDropPoints": drop,
                            }
                        ],
                    },
                )
                self.assertEqual(probe["status"] == "unsound", drop < detectable)
                self.assertEqual("probe" in probe["gated"], drop >= detectable)

    def test_a_deterministic_criterion_gates_at_any_set_size(self):
        entry = case(FIXTURE, "twenty-cases-cannot-gate-anything-judged")
        for size in (1, 20, 90, 8400):
            with self.subTest(size):
                outcome = self.go(
                    entry,
                    {
                        **entry["suite"],
                        "casesPerArm": size,
                        "criteria": [
                            {
                                "name": "citation",
                                "kind": "deterministic",
                                "gated": True,
                                "observedDropPoints": 1,
                            }
                        ],
                    },
                )
                self.assertEqual(outcome["status"], "sound")
                self.assertEqual(outcome["gated"], ["citation"])

    def test_every_criterion_is_gated_or_reported_never_both(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                seen = outcome["gated"] + outcome["reported"]
                self.assertEqual(len(set(seen)), len(seen))
                names = {c["name"] for c in entry["suite"]["criteria"]}
                for name in seen:
                    self.assertIn(name, names)
                for item in entry["suite"]["criteria"]:
                    if item["name"] in seen:
                        continue
                    self.assertTrue(
                        any(e.startswith(item["name"]) for e in outcome["errors"])
                    )

    def test_an_ungated_criterion_is_reported_and_never_refused(self):
        entry = case(FIXTURE, "an-ungated-criterion-is-reported-rather-than-refused")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "sound")
        ungated = [c["name"] for c in entry["suite"]["criteria"] if not c["gated"]]
        self.assertEqual(outcome["reported"], ungated)
        for name in ungated:
            self.assertNotIn(name, outcome["gated"])

    def test_the_flake_budget_is_spent_per_judged_gate(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        rate = entry["policy"]["falseAlarmBps"]
        budget = entry["policy"]["flakeBudgetBps"]
        for count in (1, 2, 3, 4, 6):
            with self.subTest(count):
                criteria = [
                    {
                        "name": f"rubric_{i}",
                        "kind": "judged",
                        "gated": True,
                        "observedDropPoints": 20,
                    }
                    for i in range(count)
                ]
                outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
                self.assertEqual(outcome["expectedFalseAlarmsBps"], count * rate)
                self.assertEqual(
                    any("bps against a budget" in e for e in outcome["errors"]),
                    count * rate > budget,
                )

    def test_deterministic_gates_cost_nothing_against_the_flake_budget(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        criteria = [
            {
                "name": f"check_{i}",
                "kind": "deterministic",
                "gated": True,
                "observedDropPoints": 1,
            }
            for i in range(60)
        ]
        outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
        self.assertEqual(outcome["expectedFalseAlarmsBps"], 0)
        self.assertEqual(outcome["status"], "sound")
        self.assertEqual(len(outcome["gated"]), 60)

    def test_the_two_questions_demand_different_configurations(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        for configuration in ("tightest", "production"):
            with self.subTest(configuration):
                change = self.go(
                    entry,
                    {**entry["suite"], "configuration": configuration},
                    "did-it-change",
                )
                self.assertEqual(
                    change["status"] == "unsound", configuration != "tightest"
                )
                quality = self.go(
                    entry,
                    {**entry["suite"], "configuration": configuration, "seeds": 5},
                    "how-good-is-it",
                )
                self.assertEqual(
                    quality["status"] == "unsound", configuration != "production"
                )

    def test_a_quality_claim_from_a_single_seed_is_refused(self):
        entry = case(FIXTURE, "the-quality-question-answered-properly")
        for seeds in (1, 2, 5):
            with self.subTest(seeds):
                outcome = self.go(
                    entry, {**entry["suite"], "seeds": seeds}, "how-good-is-it"
                )
                self.assertEqual(outcome["status"] == "unsound", seeds < 2)
        change = self.go(
            entry,
            {**entry["suite"], "seeds": 1, "configuration": "tightest"},
            "did-it-change",
        )
        self.assertEqual(change["status"], "sound")

    def test_the_rerun_policy_must_be_declared_beforehand(self):
        entry = case(FIXTURE, "a-set-sized-for-the-regression-that-matters-is-sound")
        for policy in ("declared-best-of-three", "declared-single", "undeclared"):
            with self.subTest(policy):
                outcome = self.go(entry, {**entry["suite"], "rerunPolicy": policy})
                self.assertEqual(outcome["status"] == "unsound", policy == "undeclared")
