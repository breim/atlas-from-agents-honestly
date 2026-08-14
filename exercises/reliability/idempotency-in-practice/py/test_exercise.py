import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-first-attempt-lands-the-effect-and-the-record-together", "one transaction"),
    ("a-repeat-of-a-done-key-changes-nothing", "effectively once"),
    ("a-concurrent-duplicate-waits-on-the-in-flight-row", "three states, not two"),
    ("an-expired-lease-lets-the-next-worker-proceed", "a dead worker must not deadlock"),
    ("a-failure-provably-before-the-effect-is-retryable", "provably before"),
    ("a-timeout-is-not-provably-before-the-effect", "the paired read, or escalate"),
    (
        "a-timeout-now-records-that-the-effect-may-have-landed",
        "unknown leans toward it happened",
    ),
    (
        "a-rejection-before-the-effect-leaves-the-key-retryable",
        "nothing happened, nothing consumed",
    ),
    ("an-external-effect-goes-through-the-outbox", "commit the intent with the record"),
    ("a-window-shorter-than-the-approval-pause-is-unsound", "the window is the bug"),
    (
        "a-lease-shorter-than-the-slowest-call-is-unsound",
        "expiring early causes the duplicate",
    ),
    ("a-store-that-is-not-durable-is-unsound", "more durable than what repeats the call"),
    ("a-marker-and-a-write-in-different-stores-is-unsound", "the crash gap, reintroduced"),
)


class IdempotencyInPractice(unittest.TestCase):
    def setUp(self):
        self.attempt = load_impl(__file__).attempt

    def go(self, entry, request=None, store=None, config=None):
        return self.attempt(
            request or entry["request"], store or entry["store"], config or entry["config"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_an_unsound_store_never_touches_the_world(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "unsound":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["effects"], 0)
                self.assertEqual(outcome["outbox"], [])
                self.assertEqual(outcome["store"]["rows"], entry["store"]["rows"])

    def test_the_window_must_outlast_the_approval_pause(self):
        entry = case(FIXTURE, "a-first-attempt-lands-the-effect-and-the-record-together")
        pause = entry["config"]["approvalPauseMs"]
        for window in (pause - 1, pause, pause + 1):
            with self.subTest(window):
                outcome = self.go(entry, None, {**entry["store"], "windowMs": window})
                self.assertEqual(outcome["status"] == "unsound", window < pause)
        day = self.go(entry, None, {**entry["store"], "windowMs": 86400000})
        self.assertEqual(day["status"], "unsound")

    def test_the_lease_must_outlast_the_slowest_call(self):
        entry = case(FIXTURE, "a-first-attempt-lands-the-effect-and-the-record-together")
        lease = entry["config"]["leaseMs"]
        for slowest in (lease - 1, lease, lease + 1):
            with self.subTest(slowest):
                outcome = self.go(entry, {**entry["request"], "slowestCallMs": slowest})
                self.assertEqual(outcome["status"] == "unsound", slowest > lease)

    def test_durability_and_atomicity_are_both_required(self):
        entry = case(FIXTURE, "a-first-attempt-lands-the-effect-and-the-record-together")
        for field in ("durable", "transactional"):
            with self.subTest(field):
                outcome = self.go(entry, None, {**entry["store"], field: False})
                self.assertEqual(outcome["status"], "unsound")
                self.assertEqual(outcome["effects"], 0)

    def test_a_done_key_never_applies_again(self):
        entry = case(FIXTURE, "a-repeat-of-a-done-key-changes-nothing")
        for kind in ("ok", "timeout", "rejected-before-effect"):
            with self.subTest(kind):
                result = self.go(entry, {**entry["request"], "outcome": kind})
                self.assertEqual(result["status"], "deduplicated")
                self.assertEqual(result["effects"], 0)

    def test_an_in_flight_row_makes_a_duplicate_wait(self):
        entry = case(FIXTURE, "a-concurrent-duplicate-waits-on-the-in-flight-row")
        until = entry["store"]["rows"][entry["request"]["key"]]["leaseUntilMs"]
        for at in (until - 1, until, until + 1):
            with self.subTest(at):
                outcome = self.go(entry, {**entry["request"], "atMs": at})
                self.assertEqual(outcome["status"] == "waited", at < until)
                self.assertEqual(outcome["effects"], 0 if at < until else 1)

    def test_a_failed_row_is_retried_only_when_provably_before(self):
        entry = case(FIXTURE, "a-failure-provably-before-the-effect-is-retryable")
        key = entry["request"]["key"]
        for failed_before in (True, False):
            with self.subTest(failed_before):
                store = {
                    **entry["store"],
                    "rows": {
                        key: {**entry["store"]["rows"][key], "failedBefore": failed_before}
                    },
                }
                outcome = self.go(entry, None, store)
                self.assertEqual(
                    outcome["status"], "applied" if failed_before else "escalated"
                )
                self.assertEqual(outcome["effects"], 1 if failed_before else 0)

    def test_a_timeout_records_that_the_effect_may_have_landed(self):
        entry = case(FIXTURE, "a-timeout-now-records-that-the-effect-may-have-landed")
        outcome = self.go(entry)
        row = outcome["store"]["rows"][entry["request"]["key"]]
        self.assertEqual(row["state"], "FAILED")
        self.assertFalse(row["failedBefore"])
        self.assertEqual(outcome["effects"], 1)
        retried = self.go(
            entry,
            {**entry["request"], "atMs": 999999},
            {**entry["store"], "rows": outcome["store"]["rows"]},
        )
        self.assertEqual(retried["status"], "escalated")

    def test_a_rejection_before_the_effect_leaves_the_key_free(self):
        entry = case(FIXTURE, "a-rejection-before-the-effect-leaves-the-key-retryable")
        outcome = self.go(entry)
        self.assertEqual(outcome["effects"], 0)
        self.assertTrue(
            outcome["store"]["rows"][entry["request"]["key"]]["failedBefore"]
        )
        again = self.go(
            entry,
            {**entry["request"], "atMs": 999999, "outcome": "ok"},
            {**entry["store"], "rows": outcome["store"]["rows"]},
        )
        self.assertEqual(again["status"], "applied")
        self.assertEqual(again["effects"], 1)

    def test_an_external_effect_commits_an_intent(self):
        entry = case(FIXTURE, "an-external-effect-goes-through-the-outbox")
        outcome = self.go(entry)
        self.assertEqual(outcome["effects"], 0)
        self.assertEqual(
            outcome["outbox"],
            [f"{entry['request']['key']}:{entry['request']['effect']}"],
        )
        self.assertEqual(
            outcome["store"]["rows"][entry["request"]["key"]]["state"], "IN_FLIGHT"
        )
        local = self.go(entry, {**entry["request"], "external": False})
        self.assertEqual(local["effects"], 1)
        self.assertEqual(local["outbox"], [])

    def test_every_path_leaves_one_row_in_a_legal_state(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] in ("unsound", "deduplicated", "waited"):
                continue
            with self.subTest(entry["id"]):
                row = outcome["store"]["rows"][entry["request"]["key"]]
                self.assertIn(row["state"], ("IN_FLIGHT", "DONE", "FAILED"))
                self.assertEqual(row["key"], entry["request"]["key"])
