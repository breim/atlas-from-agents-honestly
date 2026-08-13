import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("answers-without-a-tool", "a run that answers straight away took one step, not zero"),
    ("one-tool-then-answers", "one tool call and an answer is two model calls"),
    ("three-tools-then-answers", "the trace records every dispatch in order"),
    ("unknown-tool-becomes-an-observation", "an unknown tool is recorded, not raised"),
    ("never-stops", "a model that never answers stops at the bound"),
    ("bound-of-one", "the bound is checked before consuming a turn, not after"),
)


class TheLoopByHand(unittest.TestCase):
    def setUp(self):
        self.run_loop = load_impl(__file__).run_loop

    def run_case(self, entry: dict) -> dict:
        return self.run_loop(entry["script"], FIXTURE["tools"], entry["maxSteps"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_bounded_run_never_reports_an_answer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                actual = self.run_case(entry)
                if actual["status"] == "bounded":
                    self.assertIsNone(actual["answer"])

    def test_no_run_ever_exceeds_its_own_bound(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                actual = self.run_case(entry)
                self.assertLessEqual(actual["steps"], entry["maxSteps"])
                self.assertLessEqual(len(actual["trace"]), entry["maxSteps"])
