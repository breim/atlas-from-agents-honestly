import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("langgraph-re-runs-an-effect-above-the-interrupt", "the credit is issued twice"),
    ("temporal-re-runs-nothing-above-the-pause", "the journalled credit is not re-issued"),
    ("langgraph-runs-an-effect-below-the-interrupt-once", "the rule, working"),
    ("temporal-runs-the-safe-node-the-same-way", "the safe shape is safe under both"),
    (
        "langgraph-re-runs-a-two-interrupt-node-twice-over",
        "two decisions, three executions",
    ),
    (
        "temporal-takes-two-decisions-without-repeating-anything",
        "two pauses cost nothing",
    ),
    (
        "langgraph-re-runs-the-parent-of-a-subgraph-too",
        "no interrupt in sight to warn you",
    ),
    ("temporal-leaves-the-parent-alone", "the parent never notices"),
    ("a-node-that-never-pauses-runs-once-under-langgraph", "no pause, no repeat"),
    (
        "a-node-that-never-pauses-runs-once-under-temporal",
        "the same, from the other side",
    ),
    ("an-empty-node-has-nothing-to-repeat", "nothing twice is still nothing"),
)

MECHANISMS = ("langgraph", "temporal")


def flatten(steps: list) -> list:
    leaves = []
    for step in steps:
        if step["kind"] == "subgraph":
            leaves.extend(flatten(step["steps"]))
        else:
            leaves.append(step)
    return leaves


class InterruptsVsSignals(unittest.TestCase):
    def setUp(self):
        self.run_impl = load_impl(__file__).run

    @staticmethod
    def pauses(program: dict) -> int:
        return sum(1 for leaf in flatten(program["steps"]) if leaf["kind"] == "interrupt")

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                program = FIXTURE["programs"][entry["program"]]
                self.assertEqual(
                    self.run_impl(program, entry["mechanism"]), entry["result"]
                )

    def test_temporal_never_repeats_an_effect_and_never_re_executes(self):
        for name, program in FIXTURE["programs"].items():
            with self.subTest(name):
                trace = self.run_impl(program, "temporal")
                self.assertEqual(trace["duplicated"], [])
                self.assertEqual(trace["executions"], 1)

    def test_both_mechanisms_do_the_same_work(self):
        for name, program in FIXTURE["programs"].items():
            with self.subTest(name):
                self.assertEqual(
                    list(dict.fromkeys(self.run_impl(program, "langgraph")["effects"])),
                    list(dict.fromkeys(self.run_impl(program, "temporal")["effects"])),
                )

    def test_an_effect_below_every_interrupt_is_never_repeated(self):
        for name, program in FIXTURE["programs"].items():
            leaves = flatten(program["steps"])
            kinds = [leaf["kind"] for leaf in leaves]
            last = len(kinds) - 1 - kinds[::-1].index("interrupt") if "interrupt" in kinds else -1
            safe = [
                leaf["name"] for leaf in leaves[last + 1 :] if leaf["kind"] == "effect"
            ]
            for mechanism in MECHANISMS:
                with self.subTest(f"{name}/{mechanism}"):
                    effects = self.run_impl(program, mechanism)["effects"]
                    for effect in safe:
                        self.assertEqual(effects.count(effect), 1)

    def test_under_langgraph_an_effect_runs_once_per_interrupt_ahead_plus_one(self):
        for name, program in FIXTURE["programs"].items():
            leaves = flatten(program["steps"])
            effects = self.run_impl(program, "langgraph")["effects"]
            for index, leaf in enumerate(leaves):
                if leaf["kind"] != "effect":
                    continue
                with self.subTest(f"{name}:{leaf['name']}"):
                    ahead = sum(
                        1 for later in leaves[index:] if later["kind"] == "interrupt"
                    )
                    self.assertEqual(effects.count(leaf["name"]), ahead + 1)

    def test_langgraph_executes_once_per_pause_plus_one_and_temporal_once(self):
        for name, program in FIXTURE["programs"].items():
            with self.subTest(name):
                self.assertEqual(
                    self.run_impl(program, "langgraph")["executions"],
                    self.pauses(program) + 1,
                )
                self.assertEqual(self.run_impl(program, "temporal")["executions"], 1)

    def test_moving_every_effect_below_the_interrupts_removes_the_repetition(self):
        for name, program in FIXTURE["programs"].items():
            with self.subTest(name):
                leaves = flatten(program["steps"])
                reordered = {
                    "steps": [l for l in leaves if l["kind"] == "interrupt"]
                    + [l for l in leaves if l["kind"] == "effect"]
                }
                self.assertEqual(
                    self.run_impl(reordered, "langgraph")["duplicated"], []
                )

    def test_wrapping_a_node_in_a_subgraph_changes_nothing(self):
        for name, program in FIXTURE["programs"].items():
            wrapped = {
                "steps": [
                    {"kind": "subgraph", "name": "wrapper", "steps": program["steps"]}
                ]
            }
            for mechanism in MECHANISMS:
                with self.subTest(f"{name}/{mechanism}"):
                    self.assertEqual(
                        self.run_impl(wrapped, mechanism),
                        self.run_impl(program, mechanism),
                    )

    def test_every_case_names_a_program_the_fixture_declares(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertIn(entry["program"], FIXTURE["programs"])
