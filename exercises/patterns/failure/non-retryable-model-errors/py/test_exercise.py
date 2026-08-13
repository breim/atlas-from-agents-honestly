import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
RETRYABLE = ("rate_limit", "server_error", "overloaded")

CASES = (
    ("a-first-attempt-that-succeeds-costs-one-call", "success does not retry"),
    ("a-rate-limit-is-retried", "a rate limit is worth trying again"),
    ("a-server-error-is-retried", "so is a server error, twice"),
    ("an-overloaded-provider-is-retried", "so is an overloaded provider"),
    ("an-invalid-request-is-not-retried", "a malformed request will fail identically"),
    ("a-rejected-credential-is-not-retried", "a bad key does not become good"),
    ("a-prompt-over-the-context-limit-is-not-retried", "the prompt will not shrink on its own"),
    (
        "a-non-retryable-error-after-a-retryable-one-stops-immediately",
        "the ladder stops on the first fatal error",
    ),
    ("retries-are-bounded", "exhausted is not the same as failed"),
    ("an-unknown-error-is-treated-as-non-retryable", "an unknown code does not multiply traffic"),
)


class Scripted:
    """Counts real calls, so a 'non-retryable' error that is retried anyway shows up."""

    def __init__(self, outcomes: list):
        self.outcomes = outcomes
        self.calls = 0

    def __call__(self) -> str:
        outcome = self.outcomes[self.calls] if self.calls < len(self.outcomes) else "ok"
        self.calls += 1
        return outcome


class NonRetryableModelErrors(unittest.TestCase):
    def setUp(self):
        self.call = load_impl(__file__).call

    def run_case(self, entry: dict):
        scripted = Scripted(entry["outcomes"])
        return self.call(scripted, FIXTURE["maxAttempts"]), scripted.calls

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                outcome, _ = self.run_case(entry)
                self.assertEqual(outcome, entry["result"])

    def test_the_reported_attempt_count_is_real(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, calls = self.run_case(entry)
                self.assertEqual(outcome["attempts"], calls)

    def test_a_non_retryable_error_is_never_called_again(self):
        for entry in FIXTURE["cases"]:
            outcome, calls = self.run_case(entry)
            if outcome["status"] != "failed":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(entry["outcomes"][calls - 1], outcome["lastError"])
                self.assertNotIn(outcome["lastError"], RETRYABLE)

    def test_nothing_exceeds_the_attempt_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                _, calls = self.run_case(entry)
                self.assertLessEqual(calls, FIXTURE["maxAttempts"])

    def test_success_reports_no_error_and_failure_reports_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, _ = self.run_case(entry)
                if outcome["status"] == "ok":
                    self.assertIsNone(outcome["lastError"])
                else:
                    self.assertTrue(outcome["lastError"])
