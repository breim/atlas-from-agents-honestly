import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = {key: FIXTURE[key] for key in ("fastAttempts", "fastMs", "slowAttempts", "slowMs")}
CEILING = POLICY["fastAttempts"] + POLICY["slowAttempts"]

CASES = (
    ("the-first-attempt-waits-for-nothing", "the first attempt is immediate"),
    ("a-blip-is-absorbed-by-the-fast-tier", "a single failure retries fast"),
    ("the-fast-tier-is-exhausted-before-the-slow-one-begins", "the tiers do not interleave"),
    ("the-slow-tier-takes-over-for-an-outage", "a sustained failure backs off hard"),
    ("both-tiers-exhausted-gives-up", "giving up is a real outcome"),
    ("failing-forever-still-stops", "no schedule is unbounded"),
)


class FastSlowRetries(unittest.TestCase):
    def setUp(self):
        self.retry = load_impl(__file__).retry

    def run_case(self, entry: dict) -> dict:
        return self.retry(entry["failures"], POLICY)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_schedule_always_begins_immediately(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry)["schedule"][0], 0)

    def test_the_schedule_length_is_the_attempt_count(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(len(result["schedule"]), result["attempts"])

    def test_no_delay_ever_decreases(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                schedule = self.run_case(entry)["schedule"]
                for earlier, later in zip(schedule, schedule[1:]):
                    self.assertGreaterEqual(later, earlier)

    def test_attempts_never_exceed_the_two_tiers_combined(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertLessEqual(self.run_case(entry)["attempts"], CEILING)

    def test_giving_up_happens_exactly_when_the_budget_ran_out(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry)["gaveUp"], entry["failures"] >= CEILING)
