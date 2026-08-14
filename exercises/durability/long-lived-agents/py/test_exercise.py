import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-burst-of-messages-produces-one-reply", "that is how people type"),
    ("a-single-message-still-waits-for-the-window", "the window is not a batch size"),
    ("nothing-arrives-and-nothing-runs", "between events nothing runs"),
    ("a-close-event-ends-the-case", "a defined end"),
    ("an-absolute-deadline-expires-the-case", "carry the deadline, sleep until it"),
    (
        "the-history-recycles-with-headroom-before-the-cap",
        "recycling at the ceiling is fatal",
    ),
    (
        "carrying-the-raw-transcript-across-a-recycle-is-warned",
        "a reference over a summary",
    ),
    ("a-recycle-mid-burst-drains-what-was-buffered", "pending signals are lost unless drained"),
)


class LongLivedAgents(unittest.TestCase):
    def setUp(self):
        self.live = load_impl(__file__).live

    def go(self, entry, events=None, config=None):
        return self.live(
            entry["events"] if events is None else events,
            config or entry["config"],
            entry["codeVersion"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_burst_becomes_one_batch_and_a_gap_starts_another(self):
        entry = case(FIXTURE, "a-burst-of-messages-produces-one-reply")
        outcome = self.go(entry)
        messages = [e for e in entry["events"] if e["kind"] == "message"]
        self.assertLess(len(outcome["batches"]), len(messages))
        for batch in outcome["batches"]:
            for index in range(1, len(batch["events"])):
                self.assertLess(
                    batch["events"][index] - batch["events"][index - 1],
                    entry["config"]["quietWindowMs"],
                )

    def test_every_message_is_acted_on_exactly_once_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                acted = [a for b in outcome["batches"] for a in b["events"]]
                self.assertEqual(len(set(acted)), len(acted))
                self.assertEqual(acted, sorted(acted))
                arrived = [
                    e["at"]
                    for e in entry["events"]
                    if e["kind"] == "message" and e["at"] < entry["config"]["deadlineAt"]
                ]
                self.assertEqual(acted, arrived)

    def test_a_batch_never_fires_before_its_window_elapsed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for batch in self.go(entry)["batches"]:
                    self.assertGreaterEqual(batch["actedAt"], batch["events"][-1])

    def test_a_new_message_restarts_the_window(self):
        entry = case(FIXTURE, "a-single-message-still-waits-for-the-window")
        window = entry["config"]["quietWindowMs"]
        chatty = [
            {"at": at, "kind": "message", "bytes": 10}
            for at in (0, window - 1, 2 * (window - 1), 3 * (window - 1))
        ]
        outcome = self.go(entry, chatty)
        self.assertEqual(len(outcome["batches"]), 1)
        self.assertEqual(len(outcome["batches"][0]["events"]), len(chatty))

    def test_a_recycle_happens_with_headroom(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for recycle in outcome["recycles"]:
                    self.assertLessEqual(
                        recycle["eventsBefore"], entry["config"]["historyEventCap"]
                    )
                    self.assertGreaterEqual(
                        recycle["eventsBefore"],
                        entry["config"]["historyEventCap"]
                        - entry["config"]["headroomEvents"],
                    )

    def test_a_recycle_resets_the_history(self):
        entry = case(FIXTURE, "the-history-recycles-with-headroom-before-the-cap")
        outcome = self.go(entry)
        self.assertTrue(outcome["recycles"])
        self.assertLess(
            outcome["historyEvents"], entry["config"]["historyEventCap"]
        )

    def test_a_recycle_drains_the_buffer_first(self):
        entry = case(FIXTURE, "a-recycle-mid-burst-drains-what-was-buffered")
        outcome = self.go(entry)
        drained = sum(r["drained"] for r in outcome["recycles"])
        self.assertGreater(drained, 0)
        acted = [a for b in outcome["batches"] for a in b["events"]]
        arrived = [e["at"] for e in entry["events"] if e["kind"] == "message"]
        self.assertEqual(acted, arrived)

    def test_what_crosses_the_boundary_is_a_choice(self):
        entry = case(FIXTURE, "the-history-recycles-with-headroom-before-the-cap")
        for carry in ("reference", "summary", "transcript"):
            with self.subTest(carry):
                outcome = self.go(entry, None, {**entry["config"], "carry": carry})
                for recycle in outcome["recycles"]:
                    self.assertEqual(recycle["carried"], carry)
                warned = any("raw transcript" in w for w in outcome["warnings"])
                self.assertEqual(warned, carry == "transcript")

    def test_the_deadline_is_absolute(self):
        entry = case(FIXTURE, "an-absolute-deadline-expires-the-case")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "expired")
        for batch in outcome["batches"]:
            for at in batch["events"]:
                self.assertLess(at, entry["config"]["deadlineAt"])
        chatty = [
            {**event, "at": index * 10} for index, event in enumerate(entry["events"])
        ]
        self.assertNotEqual(self.go(entry, chatty)["status"], "expired")

    def test_a_case_that_never_closes_is_warned_about(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                warned = any("defined end" in w for w in outcome["warnings"])
                self.assertEqual(
                    warned,
                    outcome["status"] == "open" and bool(entry["events"]),
                )
                if outcome["status"] == "closed":
                    self.assertEqual(outcome["warnings"], [])

    def test_nothing_after_a_close_is_processed(self):
        entry = case(FIXTURE, "a-close-event-ends-the-case")
        extended = entry["events"] + [{"at": 90000, "kind": "message", "bytes": 10}]
        outcome = self.go(entry, extended)
        self.assertEqual(outcome["status"], "closed")
        self.assertFalse(
            any(90000 in b["events"] for b in outcome["batches"])
        )
