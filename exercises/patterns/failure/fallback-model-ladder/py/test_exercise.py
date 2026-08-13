import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-first-model-answers", "the preferred model is tried first"),
    ("an-outage-falls-through-to-the-next-model", "capacity trouble descends the ladder"),
    ("the-ladder-descends-until-something-answers", "the descent continues while it can"),
    ("a-refusal-stops-the-ladder", "a refusal is an answer, not a failure"),
    ("a-refusal-lower-down-also-stops-the-ladder", "that holds anywhere on the ladder"),
    ("every-model-failing-exhausts-the-ladder", "running out of models is its own outcome"),
    ("failed-attempts-still-cost-money", "the failed call was billed"),
)


class FallbackModelLadder(unittest.TestCase):
    def setUp(self):
        self.ask = load_impl(__file__).ask

    def run_case(self, entry: dict) -> dict:
        return self.ask(FIXTURE["ladder"], entry["outcomes"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_ladder_is_walked_from_the_top_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tried = self.run_case(entry)["tried"]
                self.assertEqual(
                    tried, [rung["model"] for rung in FIXTURE["ladder"][: len(tried)]]
                )

    def test_spent_is_the_cost_of_every_model_tried(self):
        cost = {rung["model"]: rung["cost"] for rung in FIXTURE["ladder"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["spent"], sum(cost[m] for m in result["tried"]))

    def test_a_refusal_never_descends_to_another_model(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["status"] != "refused":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(entry["outcomes"][len(result["tried"]) - 1], "refused")

    def test_only_an_exhausted_ladder_reports_no_model(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["status"] == "exhausted":
                    self.assertIsNone(result["answeredBy"])
                else:
                    self.assertTrue(result["answeredBy"])
