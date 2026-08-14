import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("validation-on-the-entry-path-runs-local", "a cheap check skips the round trip"),
    ("a-model-call-is-never-local", "short, on the path, and still an activity"),
    ("a-step-that-heartbeats-is-never-local", "local activities have no heartbeat"),
    (
        "a-step-that-must-hear-a-signal-is-never-local",
        "a local activity blocks the mailbox",
    ),
    (
        "a-step-longer-than-the-task-window-is-never-local",
        "it would fight a mechanism it cannot join",
    ),
    ("a-step-exactly-at-the-budget-still-runs-local", "the boundary is inclusive"),
    ("everything-after-the-acknowledgement-is-left-alone", "deliberately unoptimized"),
    ("the-first-disqualifying-reason-is-the-one-reported", "the check order is fixed"),
    (
        "the-atlas-entry-path-pays-no-round-trips",
        "the whole entry path, and no dispatch",
    ),
    ("a-workflow-with-no-steps-costs-nothing", "nothing to place"),
)


class Latency(unittest.TestCase):
    def setUp(self):
        self.plan = load_impl(__file__).plan

    def run_steps(self, steps: list) -> dict:
        return self.plan(steps, FIXTURE["config"])

    def local(self, steps: list) -> list:
        placements = self.run_steps(steps)["placements"]
        return [
            step
            for step, placement in zip(steps, placements)
            if placement["mode"] == "local"
        ]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_steps(entry["steps"]), entry["result"])

    def test_one_placement_per_step_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                placements = self.run_steps(entry["steps"])["placements"]
                self.assertEqual(
                    [p["name"] for p in placements],
                    [s["name"] for s in entry["steps"]],
                )

    def test_a_model_call_is_never_placed_locally(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.local(entry["steps"]):
                    self.assertNotEqual(step["kind"], "model")
                for step in entry["steps"]:
                    forced = self.run_steps([{**step, "kind": "model"}])["placements"][0]
                    self.assertEqual(forced["mode"], "activity")
                    self.assertEqual(forced["reason"], "model_call")

    def test_nothing_that_needs_a_heartbeat_is_placed_locally(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.local(entry["steps"]):
                    self.assertFalse(step["needsHeartbeat"])
                for step in entry["steps"]:
                    forced = self.run_steps([{**step, "needsHeartbeat": True}])
                    self.assertEqual(forced["placements"][0]["mode"], "activity")

    def test_nothing_that_must_stay_reachable_is_placed_locally(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.local(entry["steps"]):
                    self.assertFalse(step["needsSignals"])
                for step in entry["steps"]:
                    forced = self.run_steps([{**step, "needsSignals": True}])
                    self.assertEqual(forced["placements"][0]["mode"], "activity")

    def test_nothing_longer_than_the_budget_is_placed_locally(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.local(entry["steps"]):
                    self.assertLessEqual(
                        step["durationMs"], FIXTURE["config"]["localBudgetMs"]
                    )

    def test_nothing_off_the_entry_path_is_placed_locally(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.local(entry["steps"]):
                    self.assertTrue(step["onEntryPath"])

    def test_the_entry_latency_counts_the_entry_path_and_nothing_else(self):
        for entry in FIXTURE["cases"]:
            if all(step["onEntryPath"] for step in entry["steps"]):
                continue
            with self.subTest(entry["id"]):
                on_path = [s for s in entry["steps"] if s["onEntryPath"]]
                self.assertEqual(
                    self.run_steps(on_path)["entryLatencyMs"],
                    self.run_steps(entry["steps"])["entryLatencyMs"],
                )

    def test_the_entry_latency_is_never_worse_than_paying_every_round_trip(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                unoptimized = sum(
                    step["durationMs"] + FIXTURE["config"]["roundTripMs"]
                    for step in entry["steps"]
                    if step["onEntryPath"]
                )
                self.assertLessEqual(
                    self.run_steps(entry["steps"])["entryLatencyMs"], unoptimized
                )

    def test_shortening_a_step_never_moves_it_off_the_local_path(self):
        for entry in FIXTURE["cases"]:
            placements = self.run_steps(entry["steps"])["placements"]
            for step, placement in zip(entry["steps"], placements):
                with self.subTest(f"{entry['id']}:{step['name']}"):
                    shortened = self.run_steps([{**step, "durationMs": 0}])["placements"][0]
                    if placement["mode"] == "local":
                        self.assertEqual(shortened["mode"], "local")
                    if placement["reason"] == "too_long":
                        self.assertEqual(shortened["mode"], "local")
