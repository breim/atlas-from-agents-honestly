import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("enters-at-the-cheapest-capable-rung", "the cheapest thing that could work goes first"),
    ("skips-rungs-that-cannot-handle-the-request", "an incapable rung is skipped, not failed"),
    ("climbs-one-rung-on-failure", "a failure escalates by exactly one"),
    ("climbs-until-something-resolves", "the ladder keeps climbing while it can"),
    ("the-top-rung-failing-ends-unresolved", "the top rung has nowhere to escalate"),
    ("every-rung-failing-ends-unresolved", "failed attempts still cost what they cost"),
    ("a-request-nothing-handles-never-starts", "no capable rung means no attempt"),
)


class EscalationLadder(unittest.TestCase):
    def setUp(self):
        self.escalate = load_impl(__file__).escalate

    def run_case(self, entry: dict) -> dict:
        return self.escalate(entry["kind"], FIXTURE["ladder"], entry["outcomes"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_path_never_descends_the_ladder(self):
        order = {rung["rung"]: index for index, rung in enumerate(FIXTURE["ladder"])}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                path = self.run_case(entry)["path"]
                for earlier, later in zip(path, path[1:]):
                    self.assertGreater(order[later], order[earlier])

    def test_every_rung_on_the_path_can_handle_the_request(self):
        by_name = {rung["rung"]: rung for rung in FIXTURE["ladder"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for name in self.run_case(entry)["path"]:
                    self.assertIn(entry["kind"], by_name[name]["handles"])

    def test_cost_is_the_sum_of_every_rung_attempted(self):
        by_name = {rung["rung"]: rung for rung in FIXTURE["ladder"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    result["cost"], sum(by_name[name]["cost"] for name in result["path"])
                )
