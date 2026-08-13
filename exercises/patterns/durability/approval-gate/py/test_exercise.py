import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("no-approval-is-a-denial-not-a-pass", "a missing approval fails closed"),
    ("a-matching-unexpired-approval-allows-the-effect", "the exact approved action goes through"),
    ("an-approval-for-a-different-amount-is-refused", "approving 500 does not approve 9000"),
    ("an-approval-for-a-different-account-is-refused", "the account is part of what was approved"),
    ("an-approval-for-a-different-tool-is-refused", "so is the tool"),
    ("an-expired-approval-is-refused", "consent has a shelf life"),
    ("expiry-is-exclusive-at-the-boundary", "at the expiry moment it is already dead"),
    (
        "a-mismatched-approval-is-refused-for-the-mismatch-not-the-expiry",
        "the reason names the real problem",
    ),
)


class ApprovalGate(unittest.TestCase):
    def setUp(self):
        self.gate = load_impl(__file__).gate

    def run_case(self, entry: dict) -> dict:
        return self.gate(FIXTURE["action"], entry["approval"], FIXTURE["now"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["verdict"])

    def test_allowed_has_no_reason_and_denied_always_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verdict = self.run_case(entry)
                if verdict["allowed"]:
                    self.assertIsNone(verdict["reason"])
                else:
                    self.assertTrue(verdict["reason"])

    def test_nothing_is_allowed_without_an_exact_action_match(self):
        action = FIXTURE["action"]
        canonical = f"{action['tool']}|{action['account']}|{action['cents']}"
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(entry["approval"]["hash"], canonical)

    def test_nothing_is_allowed_once_expired(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertLess(FIXTURE["now"], entry["approval"]["expiresAt"])
