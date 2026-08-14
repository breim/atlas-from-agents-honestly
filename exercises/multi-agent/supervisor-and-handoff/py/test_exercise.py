import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ORDER = [
    "overlapping_inputs",
    "workers_talked",
    "verified_against_conclusions",
    "no_termination_owner",
]

CASES = (
    ("a-supervisor-fans-out-and-owns-the-ending", "one owner, one spine"),
    ("a-verifier-reading-conclusions-is-a-second-vote", "a check reads the sources"),
    ("overlapping-inputs-are-not-disjoint", "two workers, one document"),
    (
        "workers-that-talk-have-bought-a-handoff-inside-a-supervisor",
        "paid for, gained nothing",
    ),
    ("a-handoff-chain-compresses-at-every-hop", "three summaries from the customer"),
    ("nobody-owns-done-so-the-budget-does", "the hot potato, with a name"),
    ("a-supervisor-that-does-not-fit-stops-cleanly", "a partial result, not a loop"),
    (
        "a-chain-that-ends-with-nobody-drops-the-ticket",
        "the other half of ambiguous ownership",
    ),
    ("a-one-agent-handoff-is-just-an-agent", "no transfer, no tax"),
)


class SupervisorAndHandoff(unittest.TestCase):
    def setUp(self):
        self.execute = load_impl(__file__).execute

    def run_case(self, entry: dict, plan: dict = None, budget: dict = None) -> dict:
        return self.execute(plan or entry["plan"], budget or entry["budget"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_supervisor_keeps_every_worker_at_the_sources(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "supervisor":
                continue
            with self.subTest(entry["id"]):
                for step in self.run_case(entry)["steps"]:
                    if step["agent"] == "synthesize":
                        continue
                    self.assertEqual(step["compressionDepth"], 1)

    def test_a_handoff_compresses_by_exactly_one_at_every_transfer(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "handoff":
                continue
            with self.subTest(entry["id"]):
                for index, step in enumerate(self.run_case(entry)["steps"]):
                    self.assertEqual(step["compressionDepth"], index + 1)

    def test_a_supervisor_always_has_a_termination_owner(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "supervisor":
                continue
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                owed = "supervisor" if result["outcome"] == "completed" else "budget"
                self.assertEqual(result["terminatedBy"], owed)

    def test_a_handoff_with_nobody_declaring_done_never_completes(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "handoff":
                continue
            with self.subTest(entry["id"]):
                orphaned = [
                    {**a, "declaresDone": False} for a in entry["plan"]["agents"]
                ]
                result = self.run_case(
                    entry, plan={**entry["plan"], "agents": orphaned}
                )
                self.assertNotEqual(result["outcome"], "completed")
                self.assertIn(result["terminatedBy"], ("budget", "nobody"))
                self.assertIn("no_termination_owner", result["violations"])

    def test_a_chain_that_runs_out_of_agents_drops_the_work(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["outcome"] != "dropped":
                continue
            with self.subTest(entry["id"]):
                last = next(
                    a
                    for a in entry["plan"]["agents"]
                    if a["name"] == result["steps"][-1]["agent"]
                )
                self.assertIsNone(last["next"])
                self.assertFalse(last["declaresDone"])
                self.assertEqual(result["terminatedBy"], "nobody")

    def test_declaring_done_removes_the_violation_and_shortens_the_run(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "handoff":
                continue
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                owned = [
                    {**a, "declaresDone": True} if a["name"] == entry["plan"]["start"] else a
                    for a in entry["plan"]["agents"]
                ]
                after = self.run_case(entry, plan={**entry["plan"], "agents": owned})
                self.assertNotIn("no_termination_owner", after["violations"])
                self.assertLessEqual(len(after["steps"]), len(before["steps"]))

    def test_nothing_ever_runs_past_the_budget(self):
        for entry in FIXTURE["cases"]:
            for max_steps in (0, 1, 3, entry["budget"]["maxSteps"], 100):
                with self.subTest(f"{entry['id']}:{max_steps}"):
                    result = self.run_case(entry, budget={"maxSteps": max_steps})
                    self.assertLessEqual(len(result["steps"]), max_steps)
                    self.assertEqual(
                        result["outcome"] == "budget_exhausted",
                        result["terminatedBy"] == "budget",
                    )
                    self.assertEqual(
                        result["outcome"] == "dropped",
                        result["terminatedBy"] == "nobody",
                    )

    def test_a_bigger_budget_never_produces_fewer_steps(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = len(self.run_case(entry)["steps"])
                richer = self.run_case(
                    entry, budget={"maxSteps": entry["budget"]["maxSteps"] + 5}
                )
                self.assertGreaterEqual(len(richer["steps"]), before)

    def test_verifying_against_sources_never_adds_a_compression(self):
        for entry in FIXTURE["cases"]:
            if entry["plan"]["topology"] != "supervisor":
                continue
            with self.subTest(entry["id"]):
                grounded = self.run_case(
                    entry, plan={**entry["plan"], "verifiesAgainst": "sources"}
                )
                hearsay = self.run_case(
                    entry, plan={**entry["plan"], "verifiesAgainst": "conclusions"}
                )

                def depth(result):
                    return next(
                        (
                            s["compressionDepth"]
                            for s in result["steps"]
                            if s["agent"] == "synthesize"
                        ),
                        None,
                    )

                if depth(grounded) is None:
                    return
                self.assertLess(depth(grounded), depth(hearsay))
                self.assertNotIn("verified_against_conclusions", grounded["violations"])
                self.assertIn("verified_against_conclusions", hearsay["violations"])

    def test_violations_are_in_a_fixed_order_without_repeats(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                violations = self.run_case(entry)["violations"]
                self.assertEqual(violations, [n for n in ORDER if n in violations])
                self.assertEqual(len(set(violations)), len(violations))

    def test_each_topology_only_reports_its_own_violations(self):
        supervisor_only = [
            "overlapping_inputs",
            "workers_talked",
            "verified_against_conclusions",
        ]
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owned = (
                    supervisor_only
                    if entry["plan"]["topology"] == "supervisor"
                    else ["no_termination_owner"]
                )
                for name in self.run_case(entry)["violations"]:
                    self.assertIn(name, owned)
