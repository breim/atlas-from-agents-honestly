import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
GRAPHS = FIXTURE["graphs"]

CASES = (
    (
        "a-crash-mid-node-re-runs-every-effect-in-it",
        "the checkpoint boundary is the node boundary",
    ),
    ("a-random-key-generated-inside-the-node-defeats-the-mechanism", "two refunds"),
    ("an-interrupt-re-executes-everything-else-in-the-node", "the double-execution problem"),
    (
        "one-call-per-node-means-a-resume-cannot-double-fire-anything-else",
        "the cheap structural fix",
    ),
    (
        "a-checkpoint-is-written-between-nodes-not-inside-them",
        "earlier nodes are not re-run",
    ),
    (
        "a-crashed-run-nobody-resumes-is-durable-and-permanently-stopped",
        "durable is not finished",
    ),
    ("a-worker-without-the-lease-does-not-resume-the-thread", "yours to build"),
)


class Persistence(unittest.TestCase):
    def setUp(self):
        self.execute = load_impl(__file__).execute

    @staticmethod
    def graph_of(entry: dict) -> dict:
        return GRAPHS[entry["graph"]]

    @staticmethod
    def config_of(entry: dict) -> dict:
        return entry.get("config", CONFIG)

    def go(
        self,
        entry: dict,
        thread: dict = None,
        store: dict = None,
        config: dict = None,
    ) -> dict:
        return self.execute(
            self.graph_of(entry),
            thread or entry["thread"],
            store or {"effects": {}},
            config or self.config_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_crash_reruns_the_whole_node_from_the_first_effect(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "stopped":
                continue
            for crash in entry["thread"]["crashes"]:
                with self.subTest(f"{entry['id']}/{crash['node']}"):
                    self.assertGreaterEqual(outcome["path"].count(crash["node"]), 2)
                    node = next(
                        n
                        for n in self.graph_of(entry)["nodes"]
                        if n["name"] == crash["node"]
                    )
                    first = node["effects"][0]["name"]
                    ran = len(
                        [
                            a
                            for a in outcome["applied"]
                            if a["node"] == crash["node"] and a["effect"] == first
                        ]
                    )
                    self.assertGreaterEqual(ran, 2)

    def test_a_node_that_completed_before_the_crash_is_never_re_entered(self):
        entry = case(FIXTURE, "a-checkpoint-is-written-between-nodes-not-inside-them")
        outcome = self.go(entry)
        crashed = entry["thread"]["crashes"][0]["node"]
        for node in self.graph_of(entry)["nodes"]:
            if node["name"] == crashed:
                continue
            with self.subTest(node["name"]):
                self.assertEqual(outcome["path"].count(node["name"]), 1)

    def test_a_checkpoint_exists_for_every_node_that_finished(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    len(set(outcome["checkpoints"])), len(outcome["checkpoints"])
                )
                for name in outcome["checkpoints"]:
                    self.assertIn(name, outcome["path"])
                if outcome["status"] == "stopped":
                    self.assertNotIn(outcome["path"][-1], outcome["checkpoints"])
                if outcome["status"] == "completed":
                    self.assertEqual(
                        len(outcome["checkpoints"]),
                        len(self.graph_of(entry)["nodes"]),
                    )

    def test_a_deterministic_key_survives_replay_and_a_random_one_does_not(self):
        keyed = case(FIXTURE, "a-crash-mid-node-re-runs-every-effect-in-it")
        random = case(
            FIXTURE, "a-random-key-generated-inside-the-node-defeats-the-mechanism"
        )
        safe = self.go(keyed)
        unsafe = self.go(random)
        self.assertEqual(safe["duplicated"], [])
        self.assertEqual(unsafe["duplicated"], ["post_refund"])

        def refunds(outcome: dict) -> list:
            return [k for k in outcome["store"]["effects"] if "post_refund" in k]

        self.assertEqual(len(refunds(safe)), 1)
        self.assertEqual(len(refunds(unsafe)), 2)
        self.assertEqual(safe["path"], unsafe["path"])

    def test_no_effect_that_landed_twice_is_missing_from_duplicated(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                landed = [
                    a
                    for a in outcome["applied"]
                    if not a["deduped"] and a["key"] is not None
                ]
                names = [a["effect"] for a in landed]
                for name in names:
                    self.assertEqual(
                        names.count(name) > 1, name in outcome["duplicated"]
                    )

    def test_a_deduped_effect_never_reaches_the_store_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for count in outcome["store"]["effects"].values():
                    self.assertEqual(count, 1)
                landed = len(
                    [
                        a
                        for a in outcome["applied"]
                        if not a["deduped"] and a["key"] is not None
                    ]
                )
                self.assertEqual(len(outcome["store"]["effects"]), landed)

    def test_a_read_only_effect_reruns_freely(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                read_only = [
                    e["name"]
                    for n in self.graph_of(entry)["nodes"]
                    for e in n["effects"]
                    if e.get("readOnly")
                ]
                outcome = self.go(entry)
                for name in read_only:
                    self.assertNotIn(name, outcome["duplicated"])
                    for item in outcome["applied"]:
                        if item["effect"] == name:
                            self.assertIsNone(item["key"])

    def test_an_interrupt_reruns_its_node_and_isolation_makes_it_harmless(self):
        inline = case(FIXTURE, "an-interrupt-re-executes-everything-else-in-the-node")
        isolated = case(
            FIXTURE, "one-call-per-node-means-a-resume-cannot-double-fire-anything-else"
        )
        messy = self.go(inline)
        clean = self.go(isolated)

        def approvals(outcome: dict) -> list:
            return [
                a
                for a in outcome["applied"]
                if a["key"] is None and "approval" in a["effect"] and not a["deduped"]
            ]

        self.assertEqual(len(approvals(messy)), 1)
        self.assertEqual(len(approvals(clean)), 1)
        self.assertTrue(messy["duplicated"])
        self.assertEqual(clean["duplicated"], [])

    def test_an_approval_is_only_ever_answered_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                approvals = [
                    e["name"]
                    for n in self.graph_of(entry)["nodes"]
                    for e in n["effects"]
                    if e.get("approval")
                ]
                outcome = self.go(entry)
                for name in approvals:
                    asked = len(
                        [
                            a
                            for a in outcome["applied"]
                            if a["effect"] == name and not a["deduped"]
                        ]
                    )
                    self.assertEqual(asked, 1)

    def test_a_refused_run_touches_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(
                    entry,
                    {**entry["thread"], "holdsLease": False},
                    None,
                    {**self.config_of(entry), "requireLease": True},
                )
                self.assertEqual(outcome["status"], "refused")
                self.assertEqual(outcome["applied"], [])
                self.assertEqual(outcome["path"], [])
                self.assertEqual(outcome["store"]["effects"], {})

    def test_two_workers_sharing_a_store_cannot_land_the_same_effect_twice(self):
        entry = case(FIXTURE, "a-crash-mid-node-re-runs-every-effect-in-it")
        first = self.go(entry, {**entry["thread"], "crashes": []})
        second = self.go(entry, {**entry["thread"], "crashes": []}, first["store"])
        for count in second["store"]["effects"].values():
            self.assertEqual(count, 1)
        for item in second["applied"]:
            if item["key"] is not None:
                self.assertTrue(item["deduped"])

    def test_a_stopped_run_leaves_its_work_half_done(self):
        entry = case(
            FIXTURE, "a-crashed-run-nobody-resumes-is-durable-and-permanently-stopped"
        )
        stopped = self.go(entry)
        resumed = self.go(
            entry, None, None, {**self.config_of(entry), "autoResume": True}
        )
        self.assertEqual(stopped["status"], "stopped")
        self.assertEqual(resumed["status"], "completed")
        self.assertLess(len(stopped["checkpoints"]), len(resumed["checkpoints"]))
        self.assertLess(len(stopped["applied"]), len(resumed["applied"]))
        self.assertEqual(stopped["duplicated"], [])
