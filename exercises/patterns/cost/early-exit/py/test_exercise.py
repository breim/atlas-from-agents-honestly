import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-free-stage-settles-it", "a cache hit costs nothing"),
    ("an-undecided-stage-hands-on", "an undecided stage passes the question along"),
    ("the-pipeline-runs-until-something-settles", "the pipeline advances while it must"),
    ("the-last-stage-settles-whatever-it-says", "there is nothing after the last stage"),
    ("a-later-stage-never-runs-once-the-question-is-settled", "settling stops the pipeline dead"),
    ("settling-late-costs-everything-before-it", "an early-exit pipeline can lose its bet"),
)


class Spy:
    """Records every stage actually executed, so running past a settled verdict is visible."""

    def __init__(self, verdicts: list):
        self.verdicts = verdicts
        self.executed: list = []

    def __call__(self, stage: str) -> str:
        self.executed.append(stage)
        index = len(self.executed) - 1
        return self.verdicts[index] if index < len(self.verdicts) else "undecided"


class EarlyExit(unittest.TestCase):
    def setUp(self):
        self.run = load_impl(__file__).run

    def execute(self, entry: dict):
        spy = Spy(entry["verdicts"])
        return self.run(FIXTURE["stages"], spy), spy.executed

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                pipeline, _ = self.execute(entry)
                self.assertEqual(pipeline, entry["result"])

    def test_the_stages_reported_as_run_really_ran(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                pipeline, executed = self.execute(entry)
                self.assertEqual(pipeline["ran"], executed)

    def test_nothing_executes_after_the_question_is_settled(self):
        for entry in FIXTURE["cases"]:
            if "settled" not in entry["verdicts"]:
                continue
            with self.subTest(entry["id"]):
                _, executed = self.execute(entry)
                self.assertEqual(len(executed), entry["verdicts"].index("settled") + 1)

    def test_spent_is_the_cost_of_exactly_the_stages_that_ran(self):
        cost = {stage["name"]: stage["cost"] for stage in FIXTURE["stages"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                pipeline, _ = self.execute(entry)
                self.assertEqual(pipeline["spent"], sum(cost[n] for n in pipeline["ran"]))

    def test_the_stages_run_are_a_prefix_of_the_pipeline(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                pipeline, _ = self.execute(entry)
                names = [s["name"] for s in FIXTURE["stages"][: len(pipeline["ran"])]]
                self.assertEqual(pipeline["ran"], names)
