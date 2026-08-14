import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("fully-deterministic-work-is-a-workflow", "known work is a workflow"),
    ("needing-a-model-does-not-make-it-an-agent", "a model step is still a workflow"),
    ("unknown-steps-make-it-an-agent", "not knowing the steps is the trigger"),
    ("unenumerable-branches-make-it-an-agent", "so is not knowing the branches"),
    ("unknown-structure-outranks-the-judgement-question", "structure decides first"),
    ("knowing-nothing-is-an-agent", "nothing known is an agent"),
)

VERDICTS = ("workflow", "workflow-with-model-steps", "agent")


class TheDeterminismTest(unittest.TestCase):
    def setUp(self):
        self.classify = load_impl(__file__).classify

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.classify(entry["signals"]), entry["verdict"])

    def test_judgement_alone_never_turns_a_workflow_into_an_agent(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                with_model = self.classify({**entry["signals"], "needsJudgement": True})
                without = self.classify({**entry["signals"], "needsJudgement": False})
                self.assertEqual(with_model == "agent", without == "agent")

    def test_every_combination_of_signals_is_classified(self):
        for steps in (True, False):
            for branches in (True, False):
                for judgement in (True, False):
                    with self.subTest(steps=steps, branches=branches, judgement=judgement):
                        verdict = self.classify(
                            {
                                "stepsKnownUpfront": steps,
                                "branchesEnumerable": branches,
                                "needsJudgement": judgement,
                            }
                        )
                        self.assertIn(verdict, VERDICTS)

    def test_losing_structural_knowledge_never_stops_it_being_an_agent(self):
        for entry in FIXTURE["cases"]:
            if self.classify(entry["signals"]) != "agent":
                continue
            with self.subTest(entry["id"]):
                for key in ("stepsKnownUpfront", "branchesEnumerable"):
                    self.assertEqual(self.classify({**entry["signals"], key: False}), "agent")

    def test_a_workflow_with_model_steps_differs_only_by_judgement(self):
        for entry in FIXTURE["cases"]:
            if self.classify(entry["signals"]) != "workflow-with-model-steps":
                continue
            with self.subTest(entry["id"]):
                plain = self.classify({**entry["signals"], "needsJudgement": False})
                self.assertEqual(plain, "workflow")
