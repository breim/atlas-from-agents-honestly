import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-succeeding-is-complete", "a clean run is complete"),
    ("some-succeeding-is-partial", "a mixed run is partial"),
    ("a-single-failure-is-still-partial-not-failed", "one failure does not discard the rest"),
    ("a-single-success-is-still-partial-not-failed", "one success is not rounded away"),
    ("everything-failing-is-failed", "a total failure is a failure"),
    ("failures-keep-their-original-order", "the failed list is not sorted"),
    ("no-work-is-complete-not-failed", "nothing to do is not a failure"),
)


class PartialResultReturn(unittest.TestCase):
    def setUp(self):
        self.collect = load_impl(__file__).collect

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.collect(entry["outcomes"]), entry["result"])

    def test_every_item_is_either_a_value_or_a_failure(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.collect(entry["outcomes"])
                self.assertEqual(
                    sorted([*result["values"], *result["failed"]]),
                    sorted(outcome["item"] for outcome in entry["outcomes"]),
                )

    def test_status_agrees_with_what_happened(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.collect(entry["outcomes"])
                if not result["failed"]:
                    label = "complete"
                elif result["values"]:
                    label = "partial"
                else:
                    label = "failed"
                self.assertEqual(result["status"], label)

    def test_coverage_matches_the_values_that_came_back(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.collect(entry["outcomes"])
                if not entry["outcomes"]:
                    ratio = 1
                else:
                    raw = len(result["values"]) / len(entry["outcomes"])
                    ratio = math.floor(raw * 10000 + 0.5) / 10000
                self.assertEqual(result["coverage"], ratio)
                self.assertTrue(0 <= result["coverage"] <= 1)

    def test_a_partial_result_is_never_collapsed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.collect(entry["outcomes"])
                if result["values"] and result["failed"]:
                    self.assertEqual(result["status"], "partial")
