import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-perfect-run-passes-everything", "a correct run scores one"),
    ("a-wrong-answer-fails-its-case", "a wrong answer is a failure"),
    ("an-unanswered-case-is-a-failure-not-an-omission", "the denominator is the golden set"),
    (
        "an-answer-to-a-case-that-is-not-in-the-set-is-ignored",
        "extra answers do not inflate the score",
    ),
    ("matching-is-exact-not-fuzzy", "casing and whitespace are not normalised away"),
    ("answering-nothing-fails-everything", "a broken harness scores zero, not one"),
)


class GoldenSet(unittest.TestCase):
    def setUp(self):
        self.score = load_impl(__file__).score

    def run_case(self, entry: dict) -> dict:
        return self.score(FIXTURE["golden"], entry["answers"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_golden_case_is_judged_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["passed"] + result["failed"]),
                    sorted(g["id"] for g in FIXTURE["golden"]),
                )

    def test_the_rate_is_always_over_the_golden_set(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                raw = len(result["passed"]) / len(FIXTURE["golden"])
                self.assertEqual(result["rate"], math.floor(raw * 10000 + 0.5) / 10000)

    def test_every_missing_case_is_also_a_failure(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for case_id in result["missing"]:
                    self.assertIn(case_id, result["failed"])

    def test_dropping_an_answer_never_raises_the_rate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)["rate"]
                for key in entry["answers"]:
                    fewer = {k: v for k, v in entry["answers"].items() if k != key}
                    self.assertLessEqual(self.score(FIXTURE["golden"], fewer)["rate"], before)
