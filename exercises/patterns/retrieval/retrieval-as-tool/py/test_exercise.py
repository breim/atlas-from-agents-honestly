import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-valid-call-returns-hits", "a well-formed call retrieves"),
    ("topk-trims-the-hits", "topK caps the result"),
    ("a-query-with-no-hits-is-a-success-not-an-error", "finding nothing is an answer"),
    ("a-missing-query-is-rejected", "a missing required argument is named"),
    ("an-empty-query-is-rejected", "whitespace is not a query"),
    ("a-non-string-query-is-rejected-not-coerced", "a number is not silently stringified"),
    ("topk-below-one-is-rejected", "zero results is not a legal request"),
    ("topk-above-the-ceiling-is-rejected", "the ceiling is enforced, not clamped"),
    ("a-fractional-topk-is-rejected", "a fractional count is not rounded"),
    ("an-unknown-argument-is-rejected", "the model cannot widen its own scope"),
)

HOSTILE = ({}, {"query": None}, {"topK": "two"}, {"query": "returns"}, {"nope": 1})


class RetrievalAsTool(unittest.TestCase):
    def setUp(self):
        self.dispatch = load_impl(__file__).dispatch

    def run_case(self, entry: dict) -> dict:
        return self.dispatch(entry["args"], FIXTURE["corpus"], FIXTURE["maxTopK"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_no_input_ever_raises(self):
        for args in HOSTILE:
            with self.subTest(repr(args)):
                self.dispatch(args, FIXTURE["corpus"], FIXTURE["maxTopK"])

    def test_every_rejection_carries_a_code_and_a_message(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertTrue(result["error"])
                self.assertTrue(result["message"])

    def test_a_successful_call_never_returns_more_than_asked(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(result["hits"]), entry["args"]["topK"])
