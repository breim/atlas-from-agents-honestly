import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-confident-cheap-answer-stops-the-cascade", "the cheap model answers when it is sure"),
    ("the-threshold-is-inclusive", "exactly at the bar is confident enough"),
    ("low-confidence-escalates-one-rung", "an unsure answer buys the next model"),
    ("the-cascade-climbs-until-something-is-confident", "the climb continues while it can"),
    ("the-top-rung-is-accepted-however-unsure-it-is", "no answer is not better than an unsure one"),
    (
        "escalating-all-the-way-costs-more-than-going-straight-to-the-top",
        "a cascade is a bet, and it can lose",
    ),
)


class ModelCascade(unittest.TestCase):
    def setUp(self):
        self.cascade = load_impl(__file__).cascade

    def run_case(self, entry: dict) -> dict:
        return self.cascade(FIXTURE["ladder"], entry["confidences"], FIXTURE["threshold"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_ladder_is_walked_cheapest_first(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tried = self.run_case(entry)["tried"]
                self.assertEqual(
                    tried, [rung["model"] for rung in FIXTURE["ladder"][: len(tried)]]
                )

    def test_spent_is_the_cost_of_every_model_called(self):
        cost = {rung["model"]: rung["cost"] for rung in FIXTURE["ladder"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["spent"], sum(cost[m] for m in result["tried"]))

    def test_a_cascade_only_stops_early_on_a_confident_answer(self):
        for entry in FIXTURE["cases"]:
            tried = self.run_case(entry)["tried"]
            if len(tried) >= len(FIXTURE["ladder"]):
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(
                    entry["confidences"][len(tried) - 1], FIXTURE["threshold"]
                )

    def test_escalated_agrees_with_how_many_models_were_called(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["escalated"], len(result["tried"]) > 1)
