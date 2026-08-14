import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ACTIVITY_WORK = ("model", "io", "interrupt")

CASES = (
    ("in-a-real-agent-graph-exactly-one-node-is-not-an-activity", "the policy invariant"),
    ("a-node-with-no-execute-in-is-refused", "the decision you cannot skip"),
    ("a-model-call-placed-in-the-workflow-is-refused", "a model call cannot be replayed"),
    ("a-synchronous-conditional-edge-needs-porting", "edges always run in the workflow"),
    ("the-store-is-unreachable-from-an-activity-node", "it fails at the point of use"),
    (
        "an-interrupt-on-old-python-loads-with-a-warning-and-no-pause",
        "silently not there",
    ),
    (
        "the-same-graph-on-a-supported-python-warns-about-nothing",
        "the version is the difference",
    ),
    ("typescript-writes-the-workflow-by-hand", "about forty lines"),
)


class LangGraphOnTemporal(unittest.TestCase):
    def setUp(self):
        self.plan = load_impl(__file__).plan

    def go(self, entry, graph=None, runtime=None):
        return self.plan(
            graph or entry["graph"], runtime or entry["runtime"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_node_must_declare_where_it_runs(self):
        entry = case(FIXTURE, "in-a-real-agent-graph-exactly-one-node-is-not-an-activity")
        for node in entry["graph"]["nodes"]:
            with self.subTest(node["name"]):
                stripped = [
                    {"name": n["name"], "work": n["work"]} if n["name"] == node["name"] else n
                    for n in entry["graph"]["nodes"]
                ]
                outcome = self.go(entry, {**entry["graph"], "nodes": stripped})
                self.assertEqual(outcome["status"], "rejected")
                self.assertTrue(any(node["name"] in e for e in outcome["errors"]))

    def test_anything_that_touches_the_world_must_be_an_activity(self):
        for entry in FIXTURE["cases"]:
            if entry["runtime"]["language"] != "python":
                continue
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for node in entry["graph"]["nodes"]:
                    if not node.get("executeIn") or node["work"] not in ACTIVITY_WORK:
                        continue
                    misplaced = node["executeIn"] != "activity"
                    self.assertEqual(
                        any(
                            e.startswith(node["name"]) and "must execute in an activity" in e
                            for e in outcome["errors"]
                        ),
                        misplaced,
                    )

    def test_placing_effectful_work_in_the_workflow_is_always_refused(self):
        entry = case(FIXTURE, "in-a-real-agent-graph-exactly-one-node-is-not-an-activity")
        for work in ACTIVITY_WORK:
            with self.subTest(work):
                bad = self.go(
                    entry,
                    {"nodes": [{"name": "probe", "work": work, "executeIn": "workflow"}], "edges": []},
                )
                self.assertEqual(bad["status"], "rejected")
                good = self.go(
                    entry,
                    {"nodes": [{"name": "probe", "work": work, "executeIn": "activity"}], "edges": []},
                )
                self.assertEqual(good["status"], "ready")

    def test_almost_every_node_is_an_activity(self):
        entry = case(FIXTURE, "in-a-real-agent-graph-exactly-one-node-is-not-an-activity")
        outcome = self.go(entry)
        self.assertEqual(outcome["workflowCount"], 1)
        self.assertGreater(outcome["activityCount"], outcome["workflowCount"])
        stayed = next(p for p in outcome["placement"] if p["executeIn"] == "workflow")
        node = next(n for n in entry["graph"]["nodes"] if n["name"] == stayed["node"])
        self.assertNotIn(node["work"], ACTIVITY_WORK)

    def test_the_placement_covers_every_node_exactly_once(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "unsupported":
                continue
            with self.subTest(entry["id"]):
                declared = [
                    n["name"] for n in entry["graph"]["nodes"] if n.get("executeIn")
                ]
                self.assertEqual([p["node"] for p in outcome["placement"]], declared)
                self.assertEqual(
                    outcome["activityCount"] + outcome["workflowCount"], len(declared)
                )

    def test_a_synchronous_conditional_edge_is_always_refused(self):
        for entry in FIXTURE["cases"]:
            if entry["runtime"]["language"] != "python":
                continue
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for edge in entry["graph"]["edges"]:
                    if edge["async"]:
                        continue
                    self.assertTrue(any(edge["from"] in e for e in outcome["errors"]))

    def test_the_store_is_refused_in_an_activity_and_accepted_in_the_workflow(self):
        entry = case(FIXTURE, "in-a-real-agent-graph-exactly-one-node-is-not-an-activity")
        bad = self.go(
            entry,
            {"nodes": [{"name": "recall", "work": "io", "executeIn": "activity", "usesStore": True}], "edges": []},
        )
        self.assertEqual(bad["status"], "rejected")
        good = self.go(
            entry,
            {"nodes": [{"name": "recall", "work": "pure", "executeIn": "workflow", "usesStore": True}], "edges": []},
        )
        self.assertEqual(good["status"], "ready")

    def test_an_old_python_warns_rather_than_failing(self):
        entry = case(
            FIXTURE, "an-interrupt-on-old-python-loads-with-a-warning-and-no-pause"
        )
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "ready")
        self.assertTrue(outcome["warnings"])
        modern = self.go(entry, None, {**entry["runtime"], "pythonVersion": "3.12"})
        self.assertEqual(modern["warnings"], [])
        self.assertEqual(modern["placement"], outcome["placement"])

    def test_a_graph_needing_nothing_new_does_not_care_about_the_version(self):
        entry = case(FIXTURE, "in-a-real-agent-graph-exactly-one-node-is-not-an-activity")
        for version in ("3.9", "3.10", "3.11", "3.12"):
            with self.subTest(version):
                outcome = self.go(entry, None, {**entry["runtime"], "pythonVersion": version})
                self.assertEqual(outcome["warnings"], [])
        functional = self.go(
            entry,
            None,
            {**entry["runtime"], "pythonVersion": "3.10", "usesFunctionalApi": True},
        )
        self.assertTrue(functional["warnings"])

    def test_typescript_is_unsupported_and_places_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry, None, {**entry["runtime"], "language": "typescript"})
                self.assertEqual(outcome["status"], "unsupported")
                self.assertEqual(outcome["placement"], [])
                self.assertEqual(outcome["checkpointer"], "none")

    def test_temporal_history_replaces_the_checkpointer(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "unsupported":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["checkpointer"], "temporal-history")
