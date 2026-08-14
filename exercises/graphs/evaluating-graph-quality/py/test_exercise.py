import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-perfect-extraction", "a correct graph scores full marks"),
    ("a-hallucinated-triple-costs-precision-only", "an invented fact is a precision problem"),
    ("a-missed-triple-costs-recall-only", "a skipped fact is a recall problem"),
    ("the-right-endpoints-with-the-wrong-relation-is-a-different-fact", "no partial credit"),
    ("a-reversed-triple-is-also-a-different-fact", "direction is part of the fact"),
    ("extracting-nothing-has-perfect-precision-and-no-recall", "silence is perfectly precise"),
    ("an-empty-gold-graph-cannot-be-recalled-wrongly", "nothing to recall is full recall"),
    ("both-empty-is-vacuously-perfect", "nothing in, nothing wrong"),
)


def _key(triple: dict) -> str:
    return f"{triple['from']}|{triple['type']}|{triple['to']}"


def _bps(numerator: int, denominator: int) -> int:
    if denominator == 0:
        return 10000
    return math.floor(numerator * 10000 / denominator + 0.5)


class EvaluatingGraphQuality(unittest.TestCase):
    def setUp(self):
        self.evaluate = load_impl(__file__).evaluate

    def run_case(self, entry: dict) -> dict:
        return self.evaluate(entry["extracted"], entry["gold"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_spurious_and_missed_are_exactly_the_disagreements(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                truth = {_key(t) for t in entry["gold"]}
                claimed = {_key(t) for t in entry["extracted"]}
                result = self.run_case(entry)
                self.assertEqual(
                    result["spurious"], [t for t in entry["extracted"] if _key(t) not in truth]
                )
                self.assertEqual(
                    result["missed"], [t for t in entry["gold"] if _key(t) not in claimed]
                )

    def test_the_rates_agree_with_the_disagreements(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    result["precisionBps"],
                    _bps(len(entry["extracted"]) - len(result["spurious"]), len(entry["extracted"])),
                )
                self.assertEqual(
                    result["recallBps"],
                    _bps(len(entry["gold"]) - len(result["missed"]), len(entry["gold"])),
                )

    def test_a_triple_with_any_part_changed_is_never_correct(self):
        for entry in FIXTURE["cases"]:
            if not entry["gold"]:
                continue
            with self.subTest(entry["id"]):
                first = entry["gold"][0]
                mutations = [
                    {**first, "from": "other"},
                    {**first, "type": "other"},
                    {**first, "to": "other"},
                    {"from": first["to"], "type": first["type"], "to": first["from"]},
                ]
                for mutated in mutations:
                    result = self.evaluate([mutated], entry["gold"])
                    self.assertEqual(len(result["spurious"]), 1)

    def test_every_score_is_a_valid_rate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for key in ("precisionBps", "recallBps"):
                    self.assertGreaterEqual(result[key], 0)
                    self.assertLessEqual(result[key], 10000)
