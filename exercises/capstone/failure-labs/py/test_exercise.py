import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-lab-that-declares-everything-before-injecting-is-valid", "four things, up front"),
    ("a-lab-with-no-declared-invariant-proves-nothing", "what are you asserting"),
    ("a-lab-with-no-window-cannot-say-when-it-injected", "when did the fault land"),
    ("a-lab-that-collects-no-evidence-cannot-be-reviewed", "nothing to read afterwards"),
    ("inspecting-the-return-status-misses-the-effect", "the error that still moved money"),
    ("isolation-must-be-asserted-before-reranking", "before every hop"),
    (
        "an-admitted-bypass-is-not-the-same-finding-as-an-attempted-one",
        "two different results",
    ),
    ("a-bound-with-no-terminal-business-policy-is-a-dead-end", "halted, and then what"),
    ("a-finding-promoted-nowhere-will-happen-again", "the lowest layer that prevents it"),
    ("cleanup-before-preservation-destroys-the-evidence", "preserve, then clean"),
)


class FailureLabs(unittest.TestCase):
    def setUp(self):
        self.assess = load_impl(__file__).assess

    def go(self, entry, labs=None):
        return self.assess(labs if labs is not None else entry["labs"], entry["policy"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_each_declaration_is_required_on_its_own(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        for field in entry["policy"]["required"] + ["evidence"]:
            with self.subTest(field):
                labs = [
                    {**lab, field: [] if field == "evidence" else None}
                    for lab in entry["labs"]
                ]
                outcome = self.go(entry, labs)
                self.assertEqual(outcome["status"], "incomplete")
                self.assertTrue(
                    any(field in e for e in outcome["verdicts"][0]["errors"])
                )

    def test_every_isolation_checkpoint_must_be_asserted(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        for checkpoint in entry["policy"]["isolationCheckpoints"]:
            with self.subTest(checkpoint):
                labs = [
                    {
                        **lab,
                        "assertsBefore": [
                            c for c in lab["assertsBefore"] if c != checkpoint
                        ],
                    }
                    for lab in entry["labs"]
                ]
                outcome = self.go(entry, labs)
                self.assertEqual(outcome["status"], "incomplete")
                self.assertTrue(
                    any(checkpoint in e for e in outcome["verdicts"][0]["errors"])
                )

    def test_attempted_and_admitted_bypasses_are_counted_apart(self):
        entry = case(
            FIXTURE, "an-admitted-bypass-is-not-the-same-finding-as-an-attempted-one"
        )
        outcome = self.go(entry)
        self.assertTrue(outcome["attemptedBypasses"])
        self.assertTrue(outcome["admittedBypasses"])
        for name in outcome["admittedBypasses"]:
            self.assertNotIn(name, outcome["attemptedBypasses"])

    def test_an_admitted_bypass_makes_the_suite_incomplete(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        attempted = self.go(
            entry, [{**lab, "bypass": "attempted"} for lab in entry["labs"]]
        )
        self.assertEqual(attempted["status"], "complete")
        admitted = self.go(
            entry, [{**lab, "bypass": "admitted"} for lab in entry["labs"]]
        )
        self.assertEqual(admitted["status"], "incomplete")
        self.assertEqual(
            [v["status"] for v in admitted["verdicts"]],
            [v["status"] for v in attempted["verdicts"]],
        )

    def test_inspecting_only_the_return_status_is_refused(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        for inspects in ("effect-state", "return-status"):
            with self.subTest(inspects):
                outcome = self.go(
                    entry, [{**lab, "inspects": inspects} for lab in entry["labs"]]
                )
                self.assertEqual(
                    outcome["status"] == "complete", inspects == "effect-state"
                )

    def test_a_finding_is_promoted_to_a_known_layer(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        for promoted in entry["policy"]["layers"] + [None, "nowhere"]:
            with self.subTest(str(promoted)):
                outcome = self.go(
                    entry, [{**lab, "promotedTo": promoted} for lab in entry["labs"]]
                )
                owed = promoted in entry["policy"]["layers"]
                self.assertEqual(outcome["status"] == "complete", owed)
                self.assertEqual(
                    outcome["verdicts"][0]["promotedTo"], promoted if owed else None
                )

    def test_an_invalid_lab_reports_no_promotion(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for verdict in self.go(entry)["verdicts"]:
                    if verdict["status"] != "invalid":
                        continue
                    self.assertIsNone(verdict["promotedTo"])
                    self.assertTrue(verdict["errors"])

    def test_every_lab_gets_exactly_one_verdict_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    [v["lab"] for v in self.go(entry)["verdicts"]],
                    [lab["name"] for lab in entry["labs"]],
                )

    def test_a_missing_terminal_policy_or_lost_artifacts_are_fatal(self):
        entry = case(FIXTURE, "a-lab-that-declares-everything-before-injecting-is-valid")
        for field in ("boundHasTerminalPolicy", "artifactsPreserved"):
            with self.subTest(field):
                outcome = self.go(
                    entry, [{**lab, field: False} for lab in entry["labs"]]
                )
                self.assertEqual(outcome["status"], "incomplete")
                self.assertEqual(outcome["verdicts"][0]["status"], "invalid")
