import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    (
        "a-new-client-gets-the-stream-from-the-beginning",
        "nothing missed on a first attach",
    ),
    ("a-refresh-resumes-where-it-left-off", "no hole, no duplicate"),
    ("a-disconnect-does-not-stop-the-run", "a closed tab means nothing"),
    ("a-second-device-attaches-from-zero", "one run, two views"),
    ("an-explicit-stop-ends-the-run", "a real decision propagates"),
    ("a-client-can-still-read-a-finished-run", "the buffer outlives the run"),
    (
        "nobody-returning-abandons-the-run-on-a-policy",
        "decided in advance, not inferred",
    ),
    ("a-watched-run-never-goes-idle", "somebody is still reading"),
    ("coming-back-resets-the-abandon-clock", "returning is not abandoning"),
    ("resuming-past-the-end-delivers-nothing", "caught up is caught up"),
    ("an-empty-timeline-has-nothing-to-serve", "no run, no stream"),
)


class StreamingUx(unittest.TestCase):
    def setUp(self):
        self.serve = load_impl(__file__).serve

    def run_timeline(self, timeline: list) -> dict:
        return self.serve(timeline, FIXTURE["abandonAfterMinutes"])

    @staticmethod
    def emitted(timeline: list) -> list:
        return [a["text"] for a in timeline if a["kind"] == "emit"]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_timeline(entry["timeline"]), entry["result"])

    def test_a_refresh_never_starts_a_second_run(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                buffer = self.run_timeline(entry["timeline"])["buffer"]
                texts = self.emitted(entry["timeline"])
                self.assertEqual(
                    [event["text"] for event in buffer], texts[: len(buffer)]
                )

    def test_event_ids_run_from_one_in_order_with_no_gaps(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                buffer = self.run_timeline(entry["timeline"])["buffer"]
                self.assertEqual(
                    [event["id"] for event in buffer],
                    list(range(1, len(buffer) + 1)),
                )

    def test_a_delivery_is_exactly_what_the_buffer_held_past_the_last_seen(self):
        for entry in FIXTURE["cases"]:
            deliveries = self.run_timeline(entry["timeline"])["deliveries"]
            served = 0
            for index, action in enumerate(entry["timeline"]):
                if action["kind"] != "connect":
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    up_to = self.run_timeline(entry["timeline"][: index + 1])
                    since = action["lastEventId"] or 0
                    owed = [e["id"] for e in up_to["buffer"] if e["id"] > since]
                    self.assertEqual(
                        deliveries[served],
                        {"client": action["client"], "events": owed},
                    )
                served += 1
            self.assertEqual(len(deliveries), served)

    def test_a_client_never_sees_the_same_event_twice_or_skips_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                seen = {}
                for delivery in self.run_timeline(entry["timeline"])["deliveries"]:
                    for event_id in delivery["events"]:
                        previous = seen.get(delivery["client"], 0)
                        self.assertGreater(event_id, previous)
                        seen[delivery["client"]] = event_id

    def test_a_run_is_never_cancelled_without_someone_saying_stop(self):
        for entry in FIXTURE["cases"]:
            if any(a["kind"] == "stop" for a in entry["timeline"]):
                continue
            with self.subTest(entry["id"]):
                self.assertNotEqual(
                    self.run_timeline(entry["timeline"])["status"], "cancelled"
                )

    def test_saying_stop_cancels_a_run_that_was_still_going(self):
        for entry in FIXTURE["cases"]:
            if self.run_timeline(entry["timeline"])["status"] != "running":
                continue
            with self.subTest(entry["id"]):
                stopped = self.run_timeline(entry["timeline"] + [{"kind": "stop"}])
                self.assertEqual(stopped["status"], "cancelled")

    def test_a_run_that_has_ended_emits_nothing_more(self):
        for entry in FIXTURE["cases"]:
            before = self.run_timeline(entry["timeline"])
            if before["status"] == "running":
                continue
            with self.subTest(entry["id"]):
                after = self.run_timeline(
                    entry["timeline"] + [{"kind": "emit", "text": "after the end"}]
                )
                self.assertEqual(after["buffer"], before["buffer"])

    def test_one_more_client_changes_nothing_anyone_else_received(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_timeline(entry["timeline"])
                after = self.run_timeline(
                    entry["timeline"]
                    + [{"kind": "connect", "client": "late", "lastEventId": None}]
                )
                self.assertEqual(
                    after["deliveries"][: len(before["deliveries"])],
                    before["deliveries"],
                )
                self.assertEqual(after["buffer"], before["buffer"])
