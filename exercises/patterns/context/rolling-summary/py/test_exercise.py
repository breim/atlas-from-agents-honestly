import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("under-the-window", "nothing folds while the window has room"),
    ("exactly-the-window", "landing exactly on the window does not fold"),
    ("folds-the-oldest", "one turn past the window folds exactly one turn"),
    ("folds-in-arrival-order", "folded turns keep their arrival order"),
    ("window-of-one", "a window of one keeps only the latest turn"),
    ("window-of-zero-folds-everything", "a window of zero folds on arrival"),
)


class RollingSummary(unittest.TestCase):
    def setUp(self):
        self.append = load_impl(__file__).append

    def fold(self, entry: dict) -> dict:
        state = {"summary": [], "recent": []}
        for turn in entry["turns"]:
            state = self.append(state, turn, entry["keepRecent"])
        return state

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.fold(entry), entry["state"])

    def test_no_turn_is_ever_lost_or_duplicated(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                state = self.fold(entry)
                self.assertEqual(state["summary"] + state["recent"], entry["turns"])

    def test_recent_never_exceeds_the_window(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(len(self.fold(entry)["recent"]), entry["keepRecent"])
