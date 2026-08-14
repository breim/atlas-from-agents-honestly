import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-conforming-graph-validates", "a well-formed graph passes"),
    ("an-unknown-node-type-is-rejected", "the ontology decides what a node may be"),
    ("a-duplicate-node-id-is-rejected", "two nodes cannot share an id"),
    ("an-unknown-edge-type-is-rejected", "the ontology decides what a relation may be"),
    ("an-edge-to-a-missing-node-is-rejected", "an edge to nothing is not an edge"),
    ("an-edge-from-the-wrong-type-is-rejected", "an Order cannot place an Order"),
    ("an-edge-to-the-wrong-type-is-rejected", "a Customer cannot place a Product"),
    ("every-violation-is-reported-not-just-the-first", "one pass reports every problem"),
    ("an-empty-graph-validates", "an empty graph conforms"),
)


class ModelingEntities(unittest.TestCase):
    def setUp(self):
        self.validate = load_impl(__file__).validate

    def run_case(self, entry: dict) -> dict:
        return self.validate(entry["graph"], FIXTURE["ontology"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_valid_and_errors_always_agree(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["valid"], not result["errors"])

    def test_every_edge_in_a_valid_graph_respects_domain_and_range(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["valid"]:
                continue
            with self.subTest(entry["id"]):
                type_of = {n["id"]: n["type"] for n in entry["graph"]["nodes"]}
                for edge in entry["graph"]["edges"]:
                    declared = next(
                        e for e in FIXTURE["ontology"]["edgeTypes"] if e["name"] == edge["type"]
                    )
                    self.assertEqual(type_of[edge["from"]], declared["from"])
                    self.assertEqual(type_of[edge["to"]], declared["to"])

    def test_an_isolated_node_is_not_an_error(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["valid"]:
                continue
            with self.subTest(entry["id"]):
                lonely = {
                    "nodes": [*entry["graph"]["nodes"], {"id": "lonely-order", "type": "Order"}],
                    "edges": entry["graph"]["edges"],
                }
                self.assertEqual(
                    self.validate(lonely, FIXTURE["ontology"]), {"valid": True, "errors": []}
                )

    def test_every_error_names_something_in_the_graph(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                names = {n["id"] for n in entry["graph"]["nodes"]}
                for edge in entry["graph"]["edges"]:
                    names |= {edge["type"], edge["from"], edge["to"]}
                for error in self.run_case(entry)["errors"]:
                    self.assertIn(error.split(":")[1], names)
