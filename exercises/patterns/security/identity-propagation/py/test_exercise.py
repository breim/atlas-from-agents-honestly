import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-scope-both-hold-is-propagated", "the intersection lets the call through"),
    ("a-scope-only-the-service-holds-is-refused", "the agent's own reach is not the user's"),
    ("a-scope-only-the-user-holds-is-refused", "least privilege applies to the agent too"),
    ("the-effective-scope-is-the-intersection", "neither party's list is the answer alone"),
    ("an-anonymous-call-is-refused", "no identity fails closed"),
    ("a-user-with-no-scopes-can-do-nothing", "an empty scope list is not a wildcard"),
    ("the-acting-principal-is-always-the-user", "the audit trail names the person"),
)


class IdentityPropagation(unittest.TestCase):
    def setUp(self):
        self.act = load_impl(__file__).act

    def run_case(self, entry: dict) -> dict:
        return self.act(entry["user"], entry["need"], FIXTURE["service"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["verdict"])

    def test_the_service_account_is_never_the_acting_principal(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertNotEqual(
                    self.run_case(entry)["principal"], FIXTURE["service"]["principal"]
                )

    def test_nothing_is_allowed_outside_the_intersection(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertIn(entry["need"], entry["user"]["scopes"])
                self.assertIn(entry["need"], FIXTURE["service"]["scopes"])

    def test_every_scope_in_the_intersection_is_allowed_and_nothing_else(self):
        user = {"principal": "dana", "scopes": ["orders:read", "admin", "nope"]}
        universe = list(dict.fromkeys([*user["scopes"], *FIXTURE["service"]["scopes"]]))
        for need in universe:
            with self.subTest(need):
                both = need in user["scopes"] and need in FIXTURE["service"]["scopes"]
                self.assertEqual(self.act(user, need, FIXTURE["service"])["allowed"], both)

    def test_allowed_carries_no_reason_and_refusal_always_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verdict = self.run_case(entry)
                if verdict["allowed"]:
                    self.assertIsNone(verdict["reason"])
                else:
                    self.assertTrue(verdict["reason"])
