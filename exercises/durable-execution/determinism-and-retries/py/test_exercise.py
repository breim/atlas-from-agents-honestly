import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-attempt-that-succeeds-costs-no-retries", "a first-try success stops there"),
    ("a-transient-failure-is-retried", "a timeout gets another go, after a wait"),
    ("the-wait-doubles-between-attempts", "the backoff compounds"),
    ("the-wait-stops-doubling-at-the-maximum", "the interval cap holds the wait down"),
    (
        "a-business-rejection-is-not-retried",
        "the credit limit will be exceeded next time too",
    ),
    (
        "an-infrastructure-failure-in-the-same-place-is-retried",
        "the taxonomy decides, not the call site",
    ),
    ("the-attempt-cap-ends-the-retrying", "a bounded policy eventually gives up"),
    ("a-cap-of-one-means-no-retries-at-all", "one attempt is one attempt"),
    ("the-deadline-refuses-a-retry-it-cannot-fit", "no point waiting past the deadline"),
    (
        "an-unlimited-policy-never-fails-and-never-finishes",
        "the execution reads RUNNING the whole time",
    ),
)


class DeterminismAndRetries(unittest.TestCase):
    def setUp(self):
        self.execute = load_impl(__file__).execute

    def policy_for(self, entry: dict) -> dict:
        return FIXTURE["policies"][entry["policy"]]

    def run_case(self, entry: dict) -> dict:
        return self.execute(self.policy_for(entry), entry["outcomes"])

    @staticmethod
    def spent(entry: dict, attempts: int) -> int:
        return sum(o["durationMs"] for o in entry["outcomes"][:attempts])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_bounded_policy_never_makes_more_attempts_than_it_allows(self):
        for entry in FIXTURE["cases"]:
            cap = self.policy_for(entry)["maximumAttempts"]
            if cap == 0:
                continue
            with self.subTest(entry["id"]):
                self.assertLessEqual(self.run_case(entry)["attempts"], cap)

    @staticmethod
    def first_blocked(entry: dict, blocked: list) -> int:
        return next(
            (
                index
                for index, o in enumerate(entry["outcomes"], start=1)
                if o["error"] is not None and o["error"] in blocked
            ),
            0,
        )

    def test_an_error_the_policy_calls_non_retryable_is_never_attempted_twice(self):
        for entry in FIXTURE["cases"]:
            first = self.first_blocked(entry, self.policy_for(entry)["nonRetryable"])
            if not first:
                continue
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["status"], "non_retryable")
                self.assertEqual(result["attempts"], first)

    def test_marking_any_error_non_retryable_makes_it_terminal(self):
        for entry in FIXTURE["cases"]:
            failure = next(
                (o["error"] for o in entry["outcomes"] if o["error"] is not None), None
            )
            if failure is None:
                continue
            with self.subTest(entry["id"]):
                policy = {**self.policy_for(entry), "nonRetryable": [failure]}
                result = self.execute(policy, entry["outcomes"])
                self.assertEqual(result["status"], "non_retryable")
                self.assertEqual(result["attempts"], self.first_blocked(entry, [failure]))
                self.assertEqual(result["lastError"], failure)

    def test_marking_an_error_non_retryable_never_buys_more_attempts(self):
        for entry in FIXTURE["cases"]:
            before = self.run_case(entry)
            if before["lastError"] is None:
                continue
            with self.subTest(entry["id"]):
                policy = self.policy_for(entry)
                narrowed = {
                    **policy,
                    "nonRetryable": [*policy["nonRetryable"], before["lastError"]],
                }
                after = self.execute(narrowed, entry["outcomes"])
                self.assertLessEqual(after["attempts"], before["attempts"])

    def test_completed_means_the_last_attempt_made_is_the_one_that_succeeded(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                succeeded = entry["outcomes"][result["attempts"] - 1]["error"] is None
                self.assertEqual(result["status"] == "completed", succeeded)
                if result["status"] == "completed":
                    self.assertIsNone(result["lastError"])

    def test_the_elapsed_time_covers_at_least_the_attempts_that_ran(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertGreaterEqual(
                    result["elapsedMs"], self.spent(entry, result["attempts"])
                )

    def test_the_waiting_never_exceeds_one_maximum_interval_per_gap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                waited = result["elapsedMs"] - self.spent(entry, result["attempts"])
                cap = result["attempts"] * self.policy_for(entry)["maximumIntervalMs"]
                self.assertLessEqual(waited, cap)

    def test_retrying_means_every_attempt_failed_and_none_was_certain_to_fail(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["status"] != "retrying":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["attempts"], len(entry["outcomes"]))
                for outcome in entry["outcomes"]:
                    self.assertIsNotNone(outcome["error"])
                    self.assertNotIn(
                        outcome["error"], self.policy_for(entry)["nonRetryable"]
                    )

    def test_a_tighter_deadline_never_buys_more_attempts(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                policy = self.policy_for(entry)
                tighter = {
                    **policy,
                    "scheduleToCloseMs": policy["scheduleToCloseMs"] // 2,
                }
                self.assertLessEqual(
                    self.execute(tighter, entry["outcomes"])["attempts"],
                    self.run_case(entry)["attempts"],
                )

    def test_a_larger_attempt_cap_never_buys_fewer_attempts(self):
        for entry in FIXTURE["cases"]:
            policy = self.policy_for(entry)
            if policy["maximumAttempts"] == 0:
                continue
            with self.subTest(entry["id"]):
                looser = {**policy, "maximumAttempts": policy["maximumAttempts"] + 1}
                self.assertGreaterEqual(
                    self.execute(looser, entry["outcomes"])["attempts"],
                    self.run_case(entry)["attempts"],
                )
