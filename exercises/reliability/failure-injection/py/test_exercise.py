import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CAPS = FIXTURE["caps"]
SIX = ["terminal", "no_duplicate", "bounded", "escalated", "traceable", "contained"]

CASES = (
    ("a-clean-recovery-holds-every-promise", "the fault was absorbed"),
    ("a-run-that-is-neither-done-nor-failed-is-stuck", "no exception, no progress"),
    (
        "killing-between-the-effect-and-the-record-issued-two-credits",
        "the reason the dedup table exists",
    ),
    ("a-fault-handled-correctly-and-expensively", "it worked, at four times the price"),
    ("an-unresolvable-run-that-nobody-was-told-about", "a failure with no owner"),
    ("an-escalation-with-no-reason-attached", "a queue item nobody can action"),
    ("an-injected-fault-that-looks-like-a-real-one", "a game day that pages for real"),
    ("the-fallback-path-forgot-the-tenant", "a cross-tenant bug that needs an incident"),
    ("a-degraded-run-that-broke-three-promises", "each violation names its promise"),
    ("a-wrong-result-the-re-derivation-caught", "the defence the injection was for"),
    ("the-invariants-all-hold-and-the-answer-is-wrong", "the class with no signal"),
)


class FailureInjection(unittest.TestCase):
    def setUp(self):
        self.check = load_impl(__file__).check

    def run_case(self, run: dict, caps: dict = None) -> dict:
        return self.check(run, caps or CAPS)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry["run"]), entry["result"])

    def test_passed_is_exactly_whether_nothing_was_violated(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry["run"])
                self.assertEqual(result["passed"], not result["violations"])

    def test_the_six_invariants_are_partitioned(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry["run"])
                self.assertEqual(
                    sorted(result["violations"] + result["held"]), sorted(SIX)
                )
                self.assertEqual(
                    result["violations"],
                    [n for n in SIX if n in result["violations"]],
                )
                self.assertEqual(result["held"], [n for n in SIX if n in result["held"]])

    def test_whether_the_answer_was_right_is_not_an_input(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = {
                    **entry["run"],
                    "answerCorrect": not entry["run"]["answerCorrect"],
                }
                self.assertEqual(self.run_case(flipped), self.run_case(entry["run"]))

    def test_a_run_still_going_always_violates_terminal(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                stuck = self.run_case({**entry["run"], "terminalState": "running"})
                self.assertIn("terminal", stuck["violations"])
                for state in ("completed", "failed", "escalated"):
                    done = self.run_case({**entry["run"], "terminalState": state})
                    self.assertNotIn("terminal", done["violations"])

    def test_an_effect_that_happened_twice_always_violates_no_duplicate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                doubled = self.run_case(
                    {
                        **entry["run"],
                        "effects": entry["run"]["effects"]
                        + [{"name": "issue_credit", "count": 2}],
                    }
                )
                self.assertIn("no_duplicate", doubled["violations"])

    def test_raising_the_caps_never_adds_a_bounded_violation(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                generous = self.run_case(
                    entry["run"], {"costCents": 1_000_000, "turns": 1_000_000}
                )
                self.assertNotIn("bounded", generous["violations"])
                tight = self.run_case(entry["run"], {"costCents": 0, "turns": 0})
                spent = entry["run"]["costCents"] + entry["run"]["turns"]
                self.assertTrue("bounded" in tight["violations"] or spent == 0)

    def test_an_unresolvable_run_holds_only_if_it_escalated_with_a_reason(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                stranded = self.run_case(
                    {
                        **entry["run"],
                        "unresolved": True,
                        "terminalState": "failed",
                        "escalationReason": None,
                    }
                )
                self.assertIn("escalated", stranded["violations"])
                routed = self.run_case(
                    {
                        **entry["run"],
                        "unresolved": True,
                        "terminalState": "escalated",
                        "escalationReason": "because",
                    }
                )
                self.assertNotIn("escalated", routed["violations"])

    def test_an_unrecorded_fault_or_recovery_always_violates_traceable(self):
        for entry in FIXTURE["cases"]:
            for trace in (
                {"injectedFault": None, "recoveryRecorded": True},
                {"injectedFault": "anything", "recoveryRecorded": False},
            ):
                with self.subTest(f"{entry['id']}:{trace}"):
                    result = self.run_case({**entry["run"], "trace": trace})
                    self.assertIn("traceable", result["violations"])

    def test_any_boundary_crossed_always_violates_contained(self):
        for entry in FIXTURE["cases"]:
            for key in ("tenantPropagated", "taintHeld", "authorized"):
                with self.subTest(f"{entry['id']}:{key}"):
                    leaky = self.run_case(
                        {
                            **entry["run"],
                            "boundaries": {**entry["run"]["boundaries"], key: False},
                        }
                    )
                    self.assertIn("contained", leaky["violations"])
