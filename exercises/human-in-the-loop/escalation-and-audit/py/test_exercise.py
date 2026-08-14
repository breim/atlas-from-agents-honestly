import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
SILENT = ("timeout", "error", "missing-payload")

CASES = (
    ("an-approval-is-recorded-with-the-card-the-reviewer-saw", "bytes, not a reference"),
    ("a-judgement-denial-does-not-go-back-in-the-queue", "somebody decided"),
    ("silence-denies-and-routes-to-a-human", "never ask again"),
    ("an-error-fails-closed-rather-than-approving", "fail closed"),
    ("a-missing-payload-fails-closed-too", "the same answer for every fault"),
    ("a-gate-that-approves-on-silence-is-refused", "failing open is not a policy"),
    ("a-gate-with-no-backup-is-an-undefined-state", "who is the backup"),
    ("a-gate-that-never-expires-is-an-undefined-state", "when does it expire"),
    ("a-record-without-the-rendered-card-proves-nothing", "a reference proves nothing"),
)


class EscalationAndAudit(unittest.TestCase):
    def setUp(self):
        self.resolve = load_impl(__file__).resolve

    def go(self, entry, spec=None, event=None, policy=None):
        return self.resolve(
            spec or entry["spec"], event or entry["event"], policy or entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_nothing_but_an_explicit_approval_is_approved(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["outcome"] != "approved":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(entry["event"]["kind"], "answered")
                self.assertEqual(entry["event"].get("answer"), "approve")

    def test_every_way_of_not_answering_fails_closed(self):
        entry = case(FIXTURE, "an-approval-is-recorded-with-the-card-the-reviewer-saw")
        for kind in SILENT:
            with self.subTest(kind):
                outcome = self.go(entry, None, {"kind": kind, "atMs": 1000, "card": "c"})
                self.assertEqual(outcome["outcome"], "denied")
                self.assertTrue(outcome["queued"])
                self.assertIsNotNone(outcome["record"])

    def test_an_auto_denial_routes_to_a_human_and_a_judgement_does_not(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["record"] is None:
                continue
            with self.subTest(entry["id"]):
                owed = (
                    outcome["outcome"] == "denied"
                    and outcome["record"]["denialKind"] != "judgement"
                )
                self.assertEqual(outcome["queued"], owed)

    def test_a_timeout_denial_and_a_judgement_denial_are_told_apart(self):
        entry = case(FIXTURE, "a-judgement-denial-does-not-go-back-in-the-queue")
        judged = self.go(entry)
        timed_out = self.go(entry, None, {"kind": "timeout", "atMs": 700000, "card": "c"})
        self.assertEqual(judged["record"]["denialKind"], "judgement")
        self.assertEqual(timed_out["record"]["denialKind"], "timeout")
        self.assertNotEqual(judged["queued"], timed_out["queued"])

    def test_an_approval_never_carries_a_denial_kind(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if not outcome["record"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(
                    outcome["record"]["denialKind"] is None,
                    outcome["outcome"] == "approved",
                )

    def test_an_undefined_gate_records_nothing(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "undefined-gate":
                continue
            with self.subTest(entry["id"]):
                self.assertIsNone(outcome["record"])
                self.assertEqual(outcome["outcome"], "none")
                self.assertFalse(outcome["queued"])

    def test_each_of_the_three_questions_is_required(self):
        entry = case(FIXTURE, "an-approval-is-recorded-with-the-card-the-reviewer-saw")
        for field in ("onSilence", "backup", "expiresAfterMs"):
            with self.subTest(field):
                outcome = self.go(entry, {**entry["spec"], field: None})
                self.assertEqual(outcome["status"], "undefined-gate")
                self.assertTrue(outcome["errors"])

    def test_approving_on_silence_is_refused(self):
        entry = case(FIXTURE, "an-approval-is-recorded-with-the-card-the-reviewer-saw")
        openish = self.go(entry, {**entry["spec"], "onSilence": "approve"})
        self.assertEqual(openish["status"], "undefined-gate")
        self.assertTrue(any("fails open" in e for e in openish["errors"]))
        closed = self.go(entry, {**entry["spec"], "onSilence": "deny"})
        self.assertEqual(closed["status"], "recorded")

    def test_a_record_with_no_card_is_flagged(self):
        entry = case(FIXTURE, "a-record-without-the-rendered-card-proves-nothing")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "recorded")
        self.assertEqual(outcome["record"]["card"], "")
        self.assertTrue(any("card" in e for e in outcome["errors"]))
        with_card = self.go(entry, None, {**entry["event"], "card": "bytes"})
        self.assertEqual(with_card["errors"], [])

    def test_every_record_names_a_reviewer(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if not outcome["record"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(
                    outcome["record"]["reviewer"],
                    entry["event"].get("reviewer") or entry["spec"]["backup"],
                )
                self.assertTrue(outcome["record"]["reviewer"])
                self.assertTrue(outcome["record"]["reasoning"])
                self.assertIn(outcome["record"]["control"], ("hard", "soft"))

    def test_retention_is_capped(self):
        entry = case(FIXTURE, "an-approval-is-recorded-with-the-card-the-reviewer-saw")
        cap = entry["policy"]["maxRetentionDays"]
        for asked in (30, cap - 1, cap, cap + 1, 100000):
            with self.subTest(asked):
                outcome = self.go(
                    entry, None, None, {**entry["policy"], "retentionDays": asked}
                )
                self.assertEqual(outcome["record"]["retentionDays"], min(asked, cap))
