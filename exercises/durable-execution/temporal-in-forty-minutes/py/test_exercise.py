import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-fresh-execution-runs-every-activity-once", "nothing recorded, everything runs"),
    ("a-crash-and-a-replay-never-repeat-a-completed-activity", "the row that matters"),
    ("replaying-a-finished-execution-does-nothing-at-all", "replay rebuilds state, not effects"),
    (
        "a-database-read-in-workflow-code-is-a-determinism-violation",
        "reads are not harmless",
    ),
    ("the-clock-belongs-in-an-activity-too", "anything using the clock"),
    ("the-same-work-in-an-activity-is-fine", "the split, not the operation"),
    ("an-activity-retries-with-backoff-and-then-succeeds", "retries are first class"),
    (
        "an-activity-that-never-succeeds-fails-the-workflow-at-the-cap",
        "bounded, and it says so",
    ),
)


class TemporalInFortyMinutes(unittest.TestCase):
    def setUp(self):
        self.run_wf = load_impl(__file__).run

    def go(self, entry, program=None, history=None, world=None, config=None):
        return self.run_wf(
            entry["program"] if program is None else program,
            entry["history"] if history is None else history,
            world or entry["world"],
            config or entry["config"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_completed_activity_is_never_executed_again(self):
        for entry in FIXTURE["cases"]:
            first = self.go(entry)
            if first["status"] != "completed":
                continue
            with self.subTest(entry["id"]):
                second = self.go(entry, None, first["history"])
                self.assertEqual(second["executed"], [])
                self.assertEqual(second["history"], first["history"])
                self.assertEqual(second["result"], first["result"])
                third = self.go(entry, None, second["history"])
                self.assertEqual(third["executed"], [])

    def test_every_activity_is_executed_or_replayed_never_both(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                activities = [
                    s["name"] for s in entry["program"] if s["kind"] == "activity"
                ]
                seen = outcome["executed"] + outcome["replayed"]
                for name in seen:
                    self.assertIn(name, activities)
                self.assertEqual(len(set(seen)), len(seen))
                if outcome["status"] == "completed":
                    self.assertEqual(sorted(seen), sorted(activities))

    def test_a_replayed_activity_reuses_the_recorded_value(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for event in entry["history"]:
                    if event["name"] not in outcome["replayed"]:
                        continue
                    later = [e for e in outcome["history"] if e["step"] == event["step"]]
                    self.assertEqual(len(later), 1)
                    self.assertEqual(later[0]["value"], event["value"])

    def test_workflow_code_is_never_executed_as_an_activity(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for step in entry["program"]:
                    if step["kind"] != "workflow":
                        continue
                    self.assertNotIn(step["name"], outcome["executed"])
                    self.assertFalse(
                        any(e["name"] == step["name"] for e in outcome["history"])
                    )

    def test_anything_nondeterministic_in_workflow_code_stops_the_execution(self):
        entry = case(FIXTURE, "the-same-work-in-an-activity-is-fine")
        for uses in entry["config"]["nondeterministic"]:
            with self.subTest(uses):
                as_workflow = self.go(
                    entry, [{"name": "probe", "kind": "workflow", "uses": uses}]
                )
                self.assertEqual(as_workflow["status"], "nondeterministic")
                self.assertIn(uses, as_workflow["error"])
                self.assertIsNone(as_workflow["result"])
                as_activity = self.go(
                    entry,
                    [{"name": "probe", "kind": "activity", "uses": uses}],
                    [],
                    {"results": {"probe": [{"status": "ok", "value": "v"}]}},
                )
                self.assertEqual(as_activity["status"], "completed")

    def test_a_determinism_violation_records_nothing_beyond_what_happened(self):
        entry = case(
            FIXTURE, "a-database-read-in-workflow-code-is-a-determinism-violation"
        )
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "nondeterministic")
        after = next(
            i for i, s in enumerate(entry["program"]) if s.get("uses")
        )
        for event in outcome["history"]:
            self.assertLess(event["step"], after)

    def test_retries_are_bounded_with_a_deterministic_backoff(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                retry = entry["config"]["retry"]
                for attempt in outcome["attempts"]:
                    self.assertGreaterEqual(attempt["count"], 1)
                    self.assertLessEqual(attempt["count"], retry["maximumAttempts"])
                    self.assertEqual(
                        len(attempt["backoffMs"]), max(0, attempt["count"] - 1)
                    )
                    for index, wait in enumerate(attempt["backoffMs"]):
                        self.assertEqual(
                            wait,
                            retry["initialIntervalMs"]
                            * retry["backoffCoefficient"] ** index,
                        )

    def test_a_failing_activity_stops_everything_after_it(self):
        entry = case(
            FIXTURE, "an-activity-that-never-succeeds-fails-the-workflow-at-the-cap"
        )
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "failed")
        last = outcome["attempts"][-1]
        self.assertEqual(last["count"], entry["config"]["retry"]["maximumAttempts"])
        index = next(
            i for i, s in enumerate(entry["program"]) if s["name"] == last["name"]
        )
        for step in entry["program"][index + 1 :]:
            self.assertNotIn(step["name"], outcome["executed"])
        self.assertIsNone(outcome["result"])

    def test_the_history_only_grows_and_holds_one_event_per_activity(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertGreaterEqual(
                    len(outcome["history"]), len(entry["history"])
                )
                steps = [e["step"] for e in outcome["history"]]
                self.assertEqual(len(set(steps)), len(steps))
                self.assertEqual(steps, sorted(steps))
                for event in outcome["history"]:
                    self.assertEqual(
                        entry["program"][event["step"]]["name"], event["name"]
                    )
                    self.assertEqual(
                        entry["program"][event["step"]]["kind"], "activity"
                    )

    def test_resuming_from_any_prefix_reaches_the_same_result(self):
        for entry in FIXTURE["cases"]:
            full = self.go(entry)
            if full["status"] != "completed":
                continue
            for cut in range(len(full["history"]) + 1):
                with self.subTest(f"{entry['id']}/{cut}"):
                    resumed = self.go(entry, None, full["history"][:cut])
                    self.assertEqual(resumed["status"], "completed")
                    self.assertEqual(resumed["result"], full["result"])
                    self.assertEqual(resumed["history"], full["history"])
                    self.assertEqual(len(resumed["replayed"]), cut)
