import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
GRAPHS = FIXTURE["graphs"]

CASES = (
    ("the-semantic-bound-produces-a-result-not-an-exception", "halted is an outcome"),
    (
        "a-loop-you-did-not-bound-hits-the-backstop-and-that-is-an-exception",
        "a stack trace, not a result",
    ),
    (
        "a-transformed-subgraph-sees-only-what-was-passed",
        "isolation with a type signature",
    ),
    (
        "a-shared-subgraph-sees-everything-including-what-it-should-not",
        "convenient and coupled",
    ),
    ("fan-out-runs-every-branch-and-merges-through-reducers", "sectioning, as a graph"),
    ("a-router-may-only-return-a-destination-it-declared", "a graph nobody can draw"),
    ("a-router-that-reads-the-transcript-is-rejected", "decision state and nothing else"),
    (
        "a-backstop-below-the-semantic-bound-inverts-the-arrangement",
        "the last resort, firing first",
    ),
)


class RoutingAndSubgraphs(unittest.TestCase):
    def setUp(self):
        self.run_graph = load_impl(__file__).run

    @staticmethod
    def graph_of(entry: dict) -> dict:
        graph = GRAPHS[entry["graph"]]
        if "mode" not in entry:
            return graph
        return {
            **graph,
            "nodes": [
                {**n, "mode": entry["mode"]} if n["kind"] == "subgraph" else n
                for n in graph["nodes"]
            ],
        }

    @staticmethod
    def config_of(entry: dict) -> dict:
        if "backstop" in entry:
            return {**CONFIG, "backstop": entry["backstop"]}
        return CONFIG

    def go(self, entry: dict, graph: dict = None, config: dict = None) -> dict:
        return self.run_graph(
            graph or self.graph_of(entry),
            entry["input"],
            entry["updates"],
            entry["subUpdates"],
            config or self.config_of(entry),
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
                self.assertEqual(outcome["superSteps"], 0)
                self.assertEqual(outcome["state"], entry["input"])
                self.assertTrue(outcome["errors"])

    def test_every_router_destination_taken_was_declared(self):
        for entry in FIXTURE["cases"]:
            graph = self.graph_of(entry)
            outcome = self.go(entry)
            if outcome["status"] == "invalid":
                continue
            with self.subTest(entry["id"]):
                for index, visited in enumerate(outcome["path"][:-1]):
                    router = next(
                        (r for r in graph["routers"] if r["from"] == visited), None
                    )
                    if router is None:
                        continue
                    self.assertIn(outcome["path"][index + 1], router["destinations"])

    def test_an_undeclared_destination_is_always_rejected(self):
        for name, graph in GRAPHS.items():
            undeclared = [
                target
                for r in graph["routers"]
                for target in (
                    [b["to"] for b in r["branches"]]
                    + ([r["otherwise"]] if r.get("otherwise") else [])
                    + r.get("fanOut", [])
                )
                if target not in r["destinations"]
            ]
            if not undeclared:
                continue
            with self.subTest(name):
                outcome = self.run_graph(graph, {}, {}, {}, CONFIG)
                self.assertEqual(outcome["status"], "invalid")
                for target in undeclared:
                    self.assertTrue(
                        any(target in error for error in outcome["errors"])
                    )

    def test_a_backstop_undercutting_its_own_bound_is_always_rejected(self):
        for name, graph in GRAPHS.items():
            if not graph["loop"]:
                continue
            owed = graph["loop"]["bound"] * graph["loop"]["superStepsPerPass"]
            for backstop in (owed - 1, owed, owed + 1):
                with self.subTest(f"{name}/{backstop}"):
                    outcome = self.run_graph(
                        graph, {}, {}, {}, {**CONFIG, "backstop": backstop}
                    )
                    complained = outcome["status"] == "invalid" and any(
                        "backstop" in error for error in outcome["errors"]
                    )
                    self.assertEqual(complained, backstop <= owed)

    def test_a_transcript_reading_router_is_always_rejected(self):
        for name, graph in GRAPHS.items():
            offending = [
                b["when"]["field"]
                for r in graph["routers"]
                for b in r["branches"]
                if b["when"]["field"] in CONFIG["transcriptFields"]
            ]
            if not offending:
                continue
            with self.subTest(name):
                outcome = self.run_graph(graph, {}, {}, {}, CONFIG)
                self.assertEqual(outcome["status"], "invalid")

    def test_a_halted_run_is_a_result_and_a_backstopped_run_is_an_error(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                if outcome["status"] == "halted":
                    self.assertEqual(outcome["errors"], [])
                    self.assertEqual(outcome["path"][-1], "halt")
                if outcome["status"] == "crashed":
                    self.assertTrue(outcome["errors"])
                    self.assertEqual(
                        outcome["superSteps"], self.config_of(entry)["backstop"]
                    )

    def test_the_semantic_bound_stops_the_run_before_the_backstop(self):
        entry = case(FIXTURE, "the-semantic-bound-produces-a-result-not-an-exception")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "halted")
        self.assertLess(outcome["superSteps"], self.config_of(entry)["backstop"])
        loop = self.graph_of(entry)["loop"]
        self.assertLess(
            loop["bound"] * loop["superStepsPerPass"], CONFIG["backstop"]
        )

    def test_removing_the_semantic_bound_turns_a_result_into_an_exception(self):
        entry = case(FIXTURE, "the-semantic-bound-produces-a-result-not-an-exception")
        graph = self.graph_of(entry)
        unbounded = {
            **graph,
            "loop": None,
            "routers": [
                {
                    **r,
                    "branches": [b for b in r["branches"] if b["to"] != "halt"],
                }
                for r in graph["routers"]
            ],
        }
        outcome = self.run_graph(
            unbounded,
            entry["input"],
            entry["updates"],
            entry["subUpdates"],
            {**CONFIG, "backstop": 8},
        )
        self.assertEqual(outcome["status"], "crashed")
        self.assertTrue(outcome["errors"])

    def test_no_run_ever_exceeds_the_backstop(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertLessEqual(
                    outcome["superSteps"], self.config_of(entry)["backstop"]
                )
                self.assertEqual(outcome["superSteps"], len(outcome["path"]))

    def test_a_transformed_subgraph_sees_exactly_what_it_was_passed(self):
        for entry in FIXTURE["cases"]:
            graph = self.graph_of(entry)
            with self.subTest(entry["id"]):
                for view in self.go(entry)["views"]:
                    node = next(n for n in graph["nodes"] if n["name"] == view["node"])
                    if node.get("mode") != "transformed":
                        continue
                    self.assertEqual(view["saw"], sorted(node.get("passes", [])))
                    for field in CONFIG["transcriptFields"]:
                        self.assertNotIn(field, view["saw"])

    def test_a_transformed_subgraph_returns_only_what_it_declared(self):
        entry = case(FIXTURE, "a-transformed-subgraph-sees-only-what-was-passed")
        graph = self.graph_of(entry)
        node = next(n for n in graph["nodes"] if n["kind"] == "subgraph")
        outcome = self.go(entry)
        written = list(entry["subUpdates"][node["graph"]][0].keys())
        withheld = [f for f in written if f not in node.get("returns", [])]
        self.assertTrue(withheld)
        for field in withheld:
            self.assertNotIn(field, outcome["state"])
        for field in node.get("returns", []):
            self.assertIn(field, outcome["state"])

    def test_shared_mode_leaks_what_transformed_mode_withholds(self):
        entry = case(FIXTURE, "a-transformed-subgraph-sees-only-what-was-passed")
        transformed = self.go(entry, self.graph_of(entry))
        base = GRAPHS[entry["graph"]]
        shared_graph = {
            **base,
            "nodes": [
                {**n, "mode": "shared"} if n["kind"] == "subgraph" else n
                for n in base["nodes"]
            ],
        }
        shared = self.go(entry, shared_graph)
        self.assertGreater(
            len(shared["views"][0]["saw"]), len(transformed["views"][0]["saw"])
        )
        self.assertGreater(len(shared["state"]), len(transformed["state"]))
        self.assertEqual(shared["path"], transformed["path"])

    def test_fan_out_runs_every_declared_branch_exactly_once(self):
        entry = case(FIXTURE, "fan-out-runs-every-branch-and-merges-through-reducers")
        router = next(r for r in self.graph_of(entry)["routers"] if r.get("fanOut"))
        outcome = self.go(entry)
        for branch in router["fanOut"]:
            self.assertEqual(outcome["path"].count(branch), 1)
        self.assertEqual(outcome["path"][-1], router["join"])

    def test_a_commutative_reducer_survives_reordering_and_concat_does_not(self):
        entry = case(FIXTURE, "fan-out-runs-every-branch-and-merges-through-reducers")
        graph = self.graph_of(entry)
        reversed_graph = {
            **graph,
            "routers": [
                {**r, "fanOut": list(reversed(r["fanOut"]))} if r.get("fanOut") else r
                for r in graph["routers"]
            ],
        }
        forward = self.go(entry, graph)
        backward = self.go(entry, reversed_graph)
        self.assertEqual(backward["state"]["score"], forward["state"]["score"])
        self.assertEqual(
            sorted(backward["state"]["findings"]), sorted(forward["state"]["findings"])
        )
        self.assertNotEqual(
            backward["state"]["findings"], forward["state"]["findings"]
        )
