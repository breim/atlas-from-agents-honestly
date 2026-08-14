import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("zero-hops-is-just-the-start", "a budget of zero visits only the start"),
    ("one-hop-finds-the-direct-neighbours", "one hop reaches the neighbours"),
    ("two-hops-goes-one-further", "two hops reaches their neighbours"),
    ("a-cycle-terminates", "a loop does not revisit"),
    ("a-node-behind-another-tenant-is-unreachable", "the walk stops at the boundary"),
    ("another-tenants-node-is-never-visited", "a foreign node is not in anyone's results"),
    ("starting-outside-the-tenant-returns-nothing", "the start gets the same check"),
    ("an-unknown-start-returns-nothing", "a start that does not exist visits nothing"),
)


class GraphRetrieval(unittest.TestCase):
    def setUp(self):
        self.traverse = load_impl(__file__).traverse

    def run_case(self, entry: dict) -> list:
        return self.traverse(
            entry["start"],
            FIXTURE["nodes"],
            FIXTURE["edges"],
            entry["maxHops"],
            FIXTURE["tenantId"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["visited"])

    def test_no_node_from_another_tenant_is_ever_visited(self):
        foreign = {n["id"] for n in FIXTURE["nodes"] if n["tenantId"] != FIXTURE["tenantId"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for node_id in self.run_case(entry):
                    self.assertNotIn(node_id, foreign)

    def test_no_node_is_visited_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                visited = self.run_case(entry)
                self.assertEqual(len(set(visited)), len(visited))

    def test_every_visited_node_is_reachable_within_the_budget(self):
        visible = {n["id"] for n in FIXTURE["nodes"] if n["tenantId"] == FIXTURE["tenantId"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                frontier = {entry["start"]} & visible
                reachable = set(frontier)
                for _ in range(entry["maxHops"]):
                    nxt = set()
                    for edge in FIXTURE["edges"]:
                        if (
                            edge["from"] in frontier
                            and edge["to"] in visible
                            and edge["to"] not in reachable
                        ):
                            nxt.add(edge["to"])
                            reachable.add(edge["to"])
                    frontier = nxt
                for node_id in self.run_case(entry):
                    self.assertIn(node_id, reachable)

    def test_a_bigger_budget_never_visits_fewer_nodes(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                further = self.traverse(
                    entry["start"],
                    FIXTURE["nodes"],
                    FIXTURE["edges"],
                    entry["maxHops"] + 1,
                    FIXTURE["tenantId"],
                )
                self.assertGreaterEqual(len(further), len(self.run_case(entry)))
