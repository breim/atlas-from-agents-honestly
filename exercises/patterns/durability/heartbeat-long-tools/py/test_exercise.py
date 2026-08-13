import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("steady-heartbeats-keep-the-activity-alive", "a beating activity is a live activity"),
    ("a-gap-longer-than-the-timeout-is-a-death", "silence past the timeout is death"),
    ("an-activity-that-never-beats-dies-at-the-timeout", "starting is not proof of life"),
    ("a-gap-exactly-at-the-timeout-is-still-alive", "the comparison is strict"),
    ("one-past-the-timeout-is-a-death", "one unit over is over"),
    ("the-silence-after-the-last-beat-also-counts", "the final gap is a gap"),
    ("a-long-activity-that-keeps-beating-is-not-declared-dead", "slow is not dead"),
    ("the-first-fatal-gap-wins", "the reported time is the first death"),
)


class HeartbeatLongTools(unittest.TestCase):
    def setUp(self):
        self.monitor = load_impl(__file__).monitor

    def run_case(self, entry: dict) -> dict:
        return self.monitor(
            entry["startedAt"], entry["beats"], entry["finishedAt"], FIXTURE["timeout"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_alive_has_no_time_of_death_and_dead_always_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["alive"]:
                    self.assertIsNone(result["declaredDeadAt"])
                else:
                    self.assertIsInstance(result["declaredDeadAt"], int)

    def test_death_is_always_one_timeout_after_some_beat(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["alive"]:
                continue
            with self.subTest(entry["id"]):
                marks = {at + FIXTURE["timeout"] for at in [entry["startedAt"], *entry["beats"]]}
                self.assertIn(result["declaredDeadAt"], marks)

    def test_survival_means_no_gap_exceeded_the_timeout(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["alive"]:
                continue
            with self.subTest(entry["id"]):
                marks = [entry["startedAt"], *entry["beats"], entry["finishedAt"]]
                for earlier, later in zip(marks, marks[1:]):
                    self.assertLessEqual(later - earlier, FIXTURE["timeout"])
