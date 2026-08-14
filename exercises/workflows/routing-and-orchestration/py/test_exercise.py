import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-first-capable-handler-answers", "the cheapest capable handler goes first"),
    ("a-decline-moves-to-the-next-handler", "a decline is a routing signal"),
    ("an-error-stops-the-orchestration", "an error is a fault, not a decline"),
    (
        "a-handler-that-does-not-declare-the-kind-is-never-called",
        "capability is declared, not discovered",
    ),
    ("declines-cascade-to-the-last-handler", "declines chain all the way down"),
    ("everyone-declining-leaves-the-request-unhandled", "a coverage gap has its own status"),
    ("an-error-late-in-the-chain-still-stops-everything", "position does not soften a fault"),
    ("a-kind-nobody-declares-is-unroutable", "nothing capable is its own status"),
)


class RoutingAndOrchestration(unittest.TestCase):
    def setUp(self):
        self.orchestrate = load_impl(__file__).orchestrate

    def run_case(self, entry: dict) -> dict:
        return self.orchestrate(entry["kind"], FIXTURE["handlers"], entry["outcomes"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_nothing_incapable_is_ever_dispatched_to(self):
        by_name = {h["name"]: h for h in FIXTURE["handlers"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for name in self.run_case(entry)["dispatched"]:
                    self.assertIn(entry["kind"], by_name[name]["handles"])

    def test_dispatch_follows_declaration_order_without_gaps(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                capable = [
                    h["name"] for h in FIXTURE["handlers"] if entry["kind"] in h["handles"]
                ]
                dispatched = self.run_case(entry)["dispatched"]
                self.assertEqual(dispatched, capable[: len(dispatched)])

    def test_an_error_is_never_routed_around(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            broken = [n for n in result["dispatched"] if entry["outcomes"].get(n) == "error"]
            if not broken:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["status"], "failed")
                self.assertEqual(result["failedBy"], broken[0])
                self.assertEqual(result["dispatched"][-1], broken[0])

    def test_only_an_answered_run_names_a_handler(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["status"] == "answered":
                    self.assertTrue(result["answeredBy"])
                else:
                    self.assertIsNone(result["answeredBy"])

    def test_turning_an_error_into_a_decline_changes_the_outcome(self):
        for entry in FIXTURE["cases"]:
            if self.run_case(entry)["status"] != "failed":
                continue
            with self.subTest(entry["id"]):
                softened = {
                    name: ("decline" if outcome == "error" else outcome)
                    for name, outcome in entry["outcomes"].items()
                }
                status = self.orchestrate(
                    entry["kind"], FIXTURE["handlers"], softened
                )["status"]
                self.assertNotEqual(status, "failed")
