import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    (
        "a-bound-token-with-the-right-scope-is-accepted",
        "a valid, bound, scoped token passes",
    ),
    (
        "a-token-issued-for-another-server-is-rejected",
        "the confused deputy is refused at the door",
    ),
    ("an-expired-token-is-rejected", "a lapsed token is not a credential"),
    ("a-token-expiring-exactly-now-is-rejected", "the expiry boundary is closed"),
    ("expiry-is-reported-before-the-audience", "the check order is fixed"),
    ("the-audience-is-reported-before-the-scope", "binding is checked before permission"),
    ("a-read-scope-does-not-grant-a-write", "reading an invoice is not crediting one"),
    ("a-token-with-no-scopes-grants-nothing", "authenticated is not authorized"),
    (
        "a-token-with-several-scopes-grants-each-of-them",
        "each granted scope is usable",
    ),
    (
        "the-requester-comes-from-the-token-not-the-arguments",
        "the model does not choose the requester",
    ),
)


class ServersClientsTransports(unittest.TestCase):
    def setUp(self):
        self.authorize = load_impl(__file__).authorize

    def run_case(self, entry: dict) -> dict:
        return self.authorize(entry["token"], entry["request"], entry["now"])

    def accepted(self) -> list:
        return [entry for entry in FIXTURE["cases"] if self.run_case(entry)["ok"]]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_an_accepted_call_always_reports_the_token_subject(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                self.assertEqual(
                    self.run_case(entry)["subject"], entry["token"]["subject"]
                )

    def test_a_rejected_call_never_reports_a_subject(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertNotIn("subject", result)

    def test_an_argument_naming_another_subject_never_changes_the_answer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                forged = {**entry["request"], "argumentSubject": "attacker"}
                self.assertEqual(
                    self.authorize(entry["token"], forged, entry["now"]),
                    self.run_case(entry),
                )

    def test_a_token_is_never_accepted_for_another_resource(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                elsewhere = {**entry["request"], "resource": "mcp.somewhere-else.example"}
                result = self.authorize(entry["token"], elsewhere, entry["now"])
                self.assertFalse(result["ok"])

    def test_every_accepted_call_asked_for_a_scope_the_token_carries(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                self.assertIn(entry["request"]["scope"], entry["token"]["scopes"])

    def test_removing_the_granted_scope_turns_acceptance_into_refusal(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                scopes = [
                    s for s in entry["token"]["scopes"] if s != entry["request"]["scope"]
                ]
                narrowed = {**entry["token"], "scopes": scopes}
                self.assertEqual(
                    self.authorize(narrowed, entry["request"], entry["now"]),
                    {"ok": False, "error": "missing_scope"},
                )

    def test_waiting_past_the_expiry_turns_acceptance_into_refusal(self):
        for entry in self.accepted():
            with self.subTest(entry["id"]):
                later = self.authorize(
                    entry["token"], entry["request"], entry["token"]["expiresAt"]
                )
                self.assertEqual(later, {"ok": False, "error": "expired"})

    def test_an_expired_token_is_refused_whatever_else_it_carries(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                token = {
                    **entry["token"],
                    "audience": entry["request"]["resource"],
                    "scopes": [entry["request"]["scope"]],
                }
                result = self.authorize(token, entry["request"], token["expiresAt"] + 1)
                self.assertEqual(result, {"ok": False, "error": "expired"})
