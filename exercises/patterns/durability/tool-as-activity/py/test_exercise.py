import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-first-run-executes-and-records", "the first pass actually runs the tool"),
    ("a-replay-returns-the-recorded-result-without-executing", "a replay does not touch the world"),
    ("a-partial-history-replays-then-executes", "replay stops where the history does"),
    ("history-is-consumed-in-order-not-by-name", "two identical calls have two distinct results"),
    ("a-history-that-disagrees-is-non-determinism", "a divergent replay refuses to guess"),
    ("no-calls-execute-nothing", "an empty workflow executes nothing"),
)


class Spy:
    """Counts real executions, so a recorded result returned after executing still counts."""

    def __init__(self):
        self.calls = 0

    def __call__(self, activity: str) -> str:
        self.calls += 1
        return f"ran {activity}"


class ToolAsActivity(unittest.TestCase):
    def setUp(self):
        self.replay = load_impl(__file__).replay

    def run_case(self, entry: dict):
        spy = Spy()
        return self.replay(entry["history"], entry["calls"], spy), spy.calls

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                outcome, _ = self.run_case(entry)
                self.assertEqual(outcome, entry["result"])

    def test_the_reported_invocation_count_is_the_real_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, executed = self.run_case(entry)
                self.assertEqual(outcome["invocations"], executed)

    def test_a_replayed_call_never_executes(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                _, executed = self.run_case(entry)
                replayed = min(len(entry["history"]), len(entry["calls"]))
                self.assertLessEqual(executed, max(0, len(entry["calls"]) - replayed))

    def test_non_determinism_leaves_the_history_untouched(self):
        for entry in FIXTURE["cases"]:
            outcome, executed = self.run_case(entry)
            if "error" not in outcome:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["history"], entry["history"])
                self.assertEqual(executed, 0)
