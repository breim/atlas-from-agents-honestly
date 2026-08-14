import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-ported-loop-looks-like-the-original", "no state machine, no resume handler"),
    ("a-model-call-in-workflow-code-is-rejected", "the one rule"),
    ("the-deadline-cannot-read-the-clock", "the server enforces it"),
    ("a-model-activity-that-does-not-heartbeat-is-billed-twice", "retried while running"),
    ("a-fast-model-activity-without-a-heartbeat-is-fine", "the hazard is slowness"),
    ("an-oversized-return-value-is-journalled-forever", "project inside the activity"),
    ("a-transcript-that-outgrows-the-history-is-rejected", "hold a reference and a cursor"),
)


class AgentAsWorkflow(unittest.TestCase):
    def setUp(self):
        self.port = load_impl(__file__).port

    def go(self, entry, plan=None, workflow_id=None, config=None):
        return self.port(
            entry["plan"] if plan is None else plan,
            entry["bounds"],
            workflow_id or entry["workflowId"],
            config or entry["config"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_nothing_that_touches_the_world_stays_in_workflow_code(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for step in entry["plan"]:
                    if step["kind"] != "workflow" or step["effect"] == "decision":
                        continue
                    self.assertTrue(
                        any(e.startswith(step["name"]) for e in outcome["errors"])
                    )
                    self.assertEqual(outcome["status"], "rejected")

    def test_a_model_call_is_rejected_in_workflow_code_and_accepted_as_an_activity(self):
        entry = case(FIXTURE, "the-ported-loop-looks-like-the-original")
        for effect in ("model", "tool"):
            with self.subTest(effect):
                as_workflow = self.go(
                    entry, [{"name": "probe", "kind": "workflow", "effect": effect}]
                )
                self.assertEqual(as_workflow["status"], "rejected")
                as_activity = self.go(
                    entry,
                    [
                        {
                            "name": "probe",
                            "kind": "activity",
                            "effect": effect,
                            "payloadBytes": 10,
                            "heartbeats": True,
                            "durationMs": 1,
                        }
                    ],
                )
                self.assertEqual(as_activity["status"], "completed")

    def test_the_clock_is_never_allowed_and_the_deadline_is_the_platform(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["bounds"]["deadline"], "platform")
                self.assertEqual(outcome["bounds"]["steps"], "yours")
                self.assertEqual(outcome["bounds"]["cost"], "yours")
                for step in entry["plan"]:
                    if step["effect"] != "clock":
                        continue
                    self.assertTrue(
                        any("run timeout" in e for e in outcome["errors"])
                    )

    def test_every_activity_gets_a_key_derived_from_the_workflow_id(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                activities = [
                    s["name"] for s in entry["plan"] if s["kind"] == "activity"
                ]
                self.assertEqual(
                    [a["name"] for a in outcome["activities"]], activities
                )
                for activity in outcome["activities"]:
                    self.assertEqual(
                        activity["idempotencyKey"],
                        f"{entry['workflowId']}:{activity['name']}",
                    )

    def test_the_key_is_stable_for_one_execution_and_different_for_another(self):
        entry = case(FIXTURE, "the-ported-loop-looks-like-the-original")
        first = self.go(entry, None, "atlas-8823")
        again = self.go(entry, None, "atlas-8823")
        other = self.go(entry, None, "atlas-9100")
        self.assertEqual(again["activities"], first["activities"])
        for index, activity in enumerate(other["activities"]):
            self.assertNotEqual(
                activity["idempotencyKey"],
                first["activities"][index]["idempotencyKey"],
            )
        keys = [a["idempotencyKey"] for a in first["activities"]]
        self.assertEqual(len(set(keys)), len(keys))

    def test_a_slow_model_activity_is_double_billed_only_without_a_heartbeat(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for activity in outcome["activities"]:
                    step = next(
                        s for s in entry["plan"] if s["name"] == activity["name"]
                    )
                    owed = (
                        step["effect"] == "model"
                        and not step.get("heartbeats")
                        and step.get("durationMs", 0) > entry["config"]["activityTimeoutMs"]
                    )
                    self.assertEqual(activity["doubleBilled"], owed)

    def test_heartbeating_is_what_fixes_it(self):
        entry = case(FIXTURE, "a-model-activity-that-does-not-heartbeat-is-billed-twice")
        fixed = self.go(
            entry,
            [
                {**s, "heartbeats": True} if s["effect"] == "model" else s
                for s in entry["plan"]
            ],
        )
        self.assertEqual(fixed["status"], "completed")
        self.assertFalse(any(a["doubleBilled"] for a in fixed["activities"]))

    def test_the_history_is_exactly_what_the_activities_return(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owed = sum(
                    s.get("payloadBytes", 0)
                    for s in entry["plan"]
                    if s["kind"] == "activity"
                )
                self.assertEqual(self.go(entry)["historyBytes"], owed)

    def test_a_payload_over_the_cap_is_refused_at_the_cap_exactly(self):
        entry = case(FIXTURE, "the-ported-loop-looks-like-the-original")
        cap = entry["config"]["maxPayloadBytes"]
        for size in (cap - 1, cap, cap + 1):
            with self.subTest(size):
                outcome = self.go(
                    entry,
                    [
                        {
                            "name": "probe",
                            "kind": "activity",
                            "effect": "tool",
                            "payloadBytes": size,
                        }
                    ],
                )
                self.assertEqual(outcome["status"] == "rejected", size > cap)

    def test_a_rejected_plan_says_every_reason(self):
        entry = case(FIXTURE, "the-ported-loop-looks-like-the-original")
        broken = self.go(
            entry,
            [
                {"name": "a", "kind": "workflow", "effect": "model"},
                {"name": "b", "kind": "workflow", "effect": "clock"},
                {
                    "name": "c",
                    "kind": "activity",
                    "effect": "tool",
                    "payloadBytes": entry["config"]["maxPayloadBytes"] + 1,
                },
            ],
        )
        self.assertEqual(broken["status"], "rejected")
        self.assertEqual(len(broken["errors"]), 3)
        for name in ("a", "b", "c"):
            self.assertTrue(any(e.startswith(name) for e in broken["errors"]))
