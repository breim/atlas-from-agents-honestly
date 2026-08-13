import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-strong-answer-passes", "a good answer clears the bar"),
    ("an-unaddressed-criterion-scores-zero", "the denominator is the rubric, not the scores"),
    ("a-veto-beats-a-high-total", "some criteria are gates, not contributions"),
    ("exactly-at-the-minimum-passes", "the minimum is inclusive"),
    ("exactly-at-the-threshold-passes", "the threshold is inclusive too"),
    ("a-perfect-score-on-the-lightest-criterion-does-not-rescue", "weights mean what they say"),
    ("a-score-for-a-criterion-not-in-the-rubric-is-ignored", "the judge cannot invent criteria"),
    ("nothing-scored-fails-everything", "an empty judgement is not a pass"),
)


class JudgeWithRubric(unittest.TestCase):
    def setUp(self):
        self.judge = load_impl(__file__).judge

    def run_case(self, entry: dict) -> dict:
        return self.judge(entry["scores"], FIXTURE["rubric"], FIXTURE["threshold"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_rubric_criterion_is_accounted_for(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                missing = [
                    c["criterion"]
                    for c in FIXTURE["rubric"]
                    if c["criterion"] not in entry["scores"]
                ]
                self.assertEqual(self.run_case(entry)["unaddressed"], missing)

    def test_a_veto_always_fails_the_verdict(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["vetoed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["verdict"], "fail")

    def test_the_total_is_the_weighted_mean_over_the_whole_rubric(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                weighted = sum(
                    entry["scores"].get(c["criterion"], 0) * c["weight"]
                    for c in FIXTURE["rubric"]
                )
                weights = sum(c["weight"] for c in FIXTURE["rubric"])
                self.assertEqual(
                    self.run_case(entry)["total"], math.floor(weighted / weights + 0.5)
                )

    def test_dropping_a_score_never_raises_the_total(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)["total"]
                for key in entry["scores"]:
                    fewer = {k: v for k, v in entry["scores"].items() if k != key}
                    result = self.judge(fewer, FIXTURE["rubric"], FIXTURE["threshold"])
                    self.assertLessEqual(result["total"], before)
