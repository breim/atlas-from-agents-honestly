import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
LIMITS = FIXTURE["limits"]
SPECS = FIXTURE["specs"]

CASES = (
    ("the-whole-agent-loop-is-one-self-edge", "every prebuilt ReAct agent, drawn"),
    ("atlas-as-a-state-machine", "six nodes, four of them without a model"),
    ("an-escalation-still-ends-at-finalize", "the outcome union, enforced structurally"),
    ("a-node-returns-an-update-not-a-new-state", "a field nobody touched survives"),
    (
        "the-cycle-is-bounded-by-a-function-of-state",
        "the step cap, relocated somewhere testable",
    ),
    (
        "an-edge-to-a-node-that-does-not-exist-is-caught",
        "caught by compile, not by a customer",
    ),
    (
        "an-unreachable-node-is-caught-before-anything-runs",
        "a node nothing can reach",
    ),
    (
        "a-node-with-no-path-to-end-is-caught-before-anything-runs",
        "a run that could never finish",
    ),
    (
        "a-cycle-that-never-satisfies-its-condition-halts",
        "bounded even when the predicate is not",
    ),
)


class StateNodesEdges(unittest.TestCase):
    def setUp(self):
        self.execute = load_impl(__file__).execute

    @staticmethod
    def spec_of(entry: dict) -> dict:
        return SPECS[entry["spec"]]

    @staticmethod
    def limits_of(entry: dict) -> dict:
        return entry.get("limits", LIMITS)

    def go(
        self,
        entry: dict,
        spec: dict = None,
        input_state: dict = None,
        updates: dict = None,
    ) -> dict:
        return self.execute(
            spec or self.spec_of(entry),
            entry["input"] if input_state is None else input_state,
            entry["updates"] if updates is None else updates,
            self.limits_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_an_invalid_graph_runs_nothing_at_all(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "invalid":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["path"], [])
                self.assertEqual(outcome["state"], entry["input"])
                self.assertEqual(outcome["position"], self.spec_of(entry)["entry"])
                self.assertTrue(outcome["errors"])

    def test_errors_agree_with_status(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    not outcome["errors"], outcome["status"] != "invalid"
                )

    def test_every_step_follows_a_declared_edge(self):
        for entry in FIXTURE["cases"]:
            spec = self.spec_of(entry)
            outcome = self.go(entry)
            if outcome["status"] == "invalid":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["path"][0], spec["entry"])

                def allowed(name: str) -> list:
                    conditional = next(
                        (e for e in spec["conditionalEdges"] if e["from"] == name), None
                    )
                    if conditional:
                        return [b["to"] for b in conditional["branches"]] + [
                            conditional["otherwise"]
                        ]
                    edge = next((e for e in spec["edges"] if e["from"] == name), None)
                    return [edge["to"]] if edge else ["END"]

                for index in range(1, len(outcome["path"])):
                    self.assertIn(
                        outcome["path"][index], allowed(outcome["path"][index - 1])
                    )
                if outcome["status"] == "completed":
                    self.assertIn("END", allowed(outcome["path"][-1]))

    def test_every_node_visited_exists_in_the_graph(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                names = {n["name"] for n in self.spec_of(entry)["nodes"]}
                for visited in self.go(entry)["path"]:
                    self.assertIn(visited, names)

    def test_a_completed_run_is_at_end_and_a_halted_one_is_on_a_node(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                names = [n["name"] for n in self.spec_of(entry)["nodes"]]
                if outcome["status"] == "completed":
                    self.assertEqual(outcome["position"], "END")
                if outcome["status"] == "halted":
                    self.assertIn(outcome["position"], names)
                    self.assertEqual(
                        len(outcome["path"]), self.limits_of(entry)["maxSteps"]
                    )

    def test_no_run_ever_exceeds_the_step_limit(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(
                    len(self.go(entry)["path"]), self.limits_of(entry)["maxSteps"]
                )

    def test_every_path_through_the_atlas_graph_ends_at_finalize(self):
        for entry in FIXTURE["cases"]:
            if entry["spec"] != "atlas":
                continue
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["status"], "completed")
                self.assertEqual(outcome["path"][-1], "finalize")

    def test_nothing_a_node_did_not_touch_is_ever_lost(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "invalid":
                continue
            with self.subTest(entry["id"]):
                written = {
                    field
                    for updates in entry["updates"].values()
                    for update in updates
                    for field in update
                }
                for field, value in entry["input"].items():
                    if field in written:
                        continue
                    self.assertEqual(outcome["state"][field], value)

    def test_every_field_an_applied_update_wrote_is_present(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "invalid":
                continue
            with self.subTest(entry["id"]):
                for name, updates in entry["updates"].items():
                    applied = outcome["path"].count(name)
                    for update in updates[:applied]:
                        for field in update:
                            self.assertIn(field, outcome["state"])

    def test_an_update_a_node_never_reached_is_never_applied(self):
        entry = case(FIXTURE, "the-cycle-is-bounded-by-a-function-of-state")
        unused = {
            **entry["updates"],
            "gather": entry["updates"]["gather"] + [{"pending": 99, "neverRan": True}],
        }
        outcome = self.go(entry, None, None, unused)
        self.assertNotIn("neverRan", outcome["state"])
        self.assertEqual(outcome["path"], entry["result"]["path"])

    def test_routing_reads_state_so_changing_state_changes_the_route(self):
        entry = case(FIXTURE, "atlas-as-a-state-machine")
        escalating = {
            **entry["updates"],
            "triage": [{"category": "human_only", "urgency": "high", "pending": 0}],
        }
        outcome = self.go(entry, None, None, escalating)
        self.assertEqual(outcome["path"][:2], ["triage", "escalate"])
        self.assertNotIn("gather", outcome["path"])

    def test_the_same_graph_and_updates_produce_the_same_path(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.go(entry), self.go(entry))

    def test_validation_is_structural(self):
        invalid = [e for e in FIXTURE["cases"] if e["result"]["status"] == "invalid"]
        self.assertTrue(invalid)
        for entry in invalid:
            with self.subTest(entry["id"]):
                noisy = self.go(
                    entry, None, {"anything": True}, {"a": [{"b": 1}], "b": [{"c": 2}]}
                )
                self.assertEqual(noisy["errors"], entry["result"]["errors"])
                self.assertEqual(noisy["path"], [])
