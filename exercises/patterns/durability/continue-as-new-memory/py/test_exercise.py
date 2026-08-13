import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-short-run-never-continues", "a conversation inside the limit stays in one run"),
    ("reaching-the-limit-continues-as-new", "hitting the limit starts a fresh history"),
    ("the-new-run-starts-from-the-carried-state", "the next event lands in the new run"),
    ("a-long-conversation-continues-more-than-once", "continuations compound"),
    ("nothing-is-lost-across-a-continuation", "no event falls through the boundary"),
    ("an-empty-conversation-is-generation-zero", "nothing said is nothing carried"),
)


class ContinueAsNewMemory(unittest.TestCase):
    def setUp(self):
        self.run = load_impl(__file__).run

    def execute(self, entry: dict) -> dict:
        return self.run(entry["events"], FIXTURE["maxEvents"], FIXTURE["keepRecent"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.execute(entry), entry["result"])

    def test_summary_and_recent_together_are_every_event(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                state = self.execute(entry)
                self.assertEqual(state["summary"] + state["recent"], entry["events"])

    def test_recent_never_exceeds_what_the_new_run_carries(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(self.execute(entry)["recent"]), FIXTURE["keepRecent"])

    def test_the_current_history_never_reaches_the_limit(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLess(self.execute(entry)["events"], FIXTURE["maxEvents"])
