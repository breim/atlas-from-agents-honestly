import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ANSWERS = ("approve", "deny", "edit", "escalate")

CASES = (
    ("an-approval-acts-on-the-one-call-the-gate-holds", "one call, one gate"),
    ("an-edit-is-what-reviewers-actually-want", "the missing fourth answer"),
    ("a-denial-carries-an-instruction-and-branches", "deny is a branch"),
    ("a-denial-with-no-reason-is-not-an-instruction", "a reason the model can act on"),
    ("an-escalation-halts-rather-than-revising", "the fourth answer"),
    (
        "a-decision-past-its-validity-is-rejected-before-it-is-recorded",
        "an update, not a signal",
    ),
    ("a-gate-holding-two-side-effects-is-refused", "resume runs it from the top"),
    ("a-gate-that-hides-a-material-fact-is-refused", "latency without oversight"),
    ("a-gate-with-only-approve-and-deny-is-refused", "four answers, not two"),
    ("an-expiry-that-outlives-the-data-is-refused", "a decision about a state"),
    ("an-execution-gate-in-the-fast-lane-is-refused", "one mixed queue, wrong attention"),
)


class ApprovalGates(unittest.TestCase):
    def setUp(self):
        self.gate = load_impl(__file__).gate

    def go(self, entry, spec=None, decision=None, presented=None):
        return self.gate(
            spec or entry["spec"],
            decision or entry["decision"],
            entry["presentedAtMs"] if presented is None else presented,
            entry["policy"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_an_invalid_gate_never_records_a_decision(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "invalid":
                continue
            with self.subTest(entry["id"]):
                self.assertIsNone(outcome["applied"])
                self.assertEqual(outcome["next"], "none")
                self.assertTrue(outcome["errors"])

    def test_a_gate_must_hold_exactly_one_side_effect(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        for effects in ([], ["a"], ["a", "b"], ["a", "b", "c"]):
            with self.subTest(len(effects)):
                outcome = self.go(entry, {**entry["spec"], "sideEffects": effects})
                self.assertEqual(outcome["status"] == "invalid", len(effects) != 1)

    def test_every_required_field_must_be_shown(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        for field in entry["policy"]["required"]:
            with self.subTest(field):
                hidden = [f for f in entry["spec"]["disclose"] if f != field]
                outcome = self.go(entry, {**entry["spec"], "disclose": hidden})
                self.assertEqual(outcome["status"], "invalid")
                self.assertTrue(any(field in e for e in outcome["errors"]))

    def test_all_four_answers_must_be_offered(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        for answer in ANSWERS:
            with self.subTest(answer):
                outcome = self.go(
                    entry,
                    {**entry["spec"], "answers": [a for a in ANSWERS if a != answer]},
                )
                self.assertEqual(outcome["status"], "invalid")
                self.assertTrue(any(answer in e for e in outcome["errors"]))

    def test_an_edit_reaches_the_world_as_the_correction(self):
        entry = case(FIXTURE, "an-edit-is-what-reviewers-actually-want")
        outcome = self.go(entry)
        self.assertEqual(outcome["next"], "act")
        self.assertEqual(outcome["applied"], entry["decision"]["edit"])
        self.assertNotEqual(outcome["applied"], entry["spec"]["sideEffects"][0])
        empty = self.go(
            entry, None, {k: v for k, v in entry["decision"].items() if k != "edit"}
        )
        self.assertEqual(empty["status"], "rejected")

    def test_deny_branches_and_escalate_stops(self):
        entry = case(FIXTURE, "a-denial-carries-an-instruction-and-branches")
        self.assertEqual(self.go(entry)["next"], "revise")
        self.assertIsNone(self.go(entry)["applied"])
        escalated = self.go(
            entry, None, {"answer": "escalate", "atMs": entry["decision"]["atMs"]}
        )
        self.assertEqual(escalated["next"], "halt")

    def test_only_an_approval_or_an_edit_reaches_the_world(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["applied"] is None:
                continue
            with self.subTest(entry["id"]):
                self.assertIn(entry["decision"]["answer"], ("approve", "edit"))
                self.assertEqual(outcome["next"], "act")

    def test_expiry_is_enforced_at_the_boundary(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        window = entry["spec"]["expiresAfterMs"]
        for age in (window - 1, window, window + 1, window + 5000):
            with self.subTest(age):
                outcome = self.go(
                    entry,
                    None,
                    {**entry["decision"], "atMs": entry["presentedAtMs"] + age},
                )
                self.assertEqual(outcome["status"] == "rejected", age > window)
                self.assertEqual(outcome["staleBy"], max(0, age - window))
                if age > window:
                    self.assertEqual(outcome["next"], "revise")

    def test_a_stale_decision_is_never_applied(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        for answer in ANSWERS:
            with self.subTest(answer):
                late = {
                    "answer": answer,
                    "atMs": entry["presentedAtMs"] + entry["spec"]["expiresAfterMs"] + 1,
                    "reason": "r",
                    "edit": "e",
                }
                outcome = self.go(entry, None, late)
                self.assertEqual(outcome["status"], "rejected")
                self.assertIsNone(outcome["applied"])

    def test_an_expiry_longer_than_the_volatility_is_refused(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        volatility = entry["policy"]["volatilityMs"]
        for expiry in (volatility - 1, volatility, volatility + 1):
            with self.subTest(expiry):
                outcome = self.go(entry, {**entry["spec"], "expiresAfterMs": expiry})
                self.assertEqual(outcome["status"] == "invalid", expiry > volatility)

    def test_the_risk_of_the_position_decides_the_lane(self):
        entry = case(FIXTURE, "an-approval-acts-on-the-one-call-the-gate-holds")
        for position in ("plan", "execution", "output", "exception"):
            with self.subTest(position):
                fast = self.go(
                    entry, {**entry["spec"], "position": position, "lane": "fast"}
                )
                self.assertEqual(fast["status"] == "invalid", position == "execution")
                slow = self.go(
                    entry, {**entry["spec"], "position": position, "lane": "deliberate"}
                )
                self.assertNotEqual(slow["status"], "invalid")
