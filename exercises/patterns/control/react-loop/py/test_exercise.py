import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("answers-on-the-first-thought", "a run can answer without acting"),
    ("one-action-then-an-answer", "the observation lands before the next thought"),
    ("an-unknown-action-observes-an-error-and-continues", "a failed action is observed, not raised"),
    ("a-model-that-never-answers-is-bounded", "the budget stops an endless loop"),
    ("the-bound-cuts-before-the-answering-step", "the bound is checked before the step, not after"),
    ("an-empty-script-is-bounded-immediately", "nothing to do is bounded, not answered"),
)


class ReactLoop(unittest.TestCase):
    def setUp(self):
        self.react = load_impl(__file__).react

    def run_case(self, entry: dict) -> dict:
        return self.react(entry["script"], FIXTURE["observations"], entry["maxSteps"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_action_carries_its_observation(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.run_case(entry)["transcript"]:
                    if "action" not in step:
                        continue
                    self.assertTrue(step.get("observation"))

    def test_bounded_has_no_answer_and_answered_has_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["status"] == "bounded":
                    self.assertIsNone(result["answer"])
                else:
                    self.assertIsNotNone(result["answer"])

    def test_the_transcript_never_exceeds_the_bound(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(self.run_case(entry)["transcript"]), entry["maxSteps"])
