import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-delegation-names-both-principals-and-is-allowed", "sub and act"),
    ("a-service-credential-is-the-confused-deputy", "nothing broken, everything wrong"),
    (
        "impersonation-authorizes-correctly-and-destroys-accountability",
        "the wrong trade",
    ),
    ("a-backend-that-filters-after-reading-was-still-read", "a display preference"),
    ("a-token-carrying-more-than-the-backend-needs-is-refused", "downscope on the way in"),
    ("a-run-that-stored-the-token-cannot-re-derive-rights", "the reference, not the token"),
    (
        "a-resumed-run-replaying-expired-rights-is-refused",
        "a revocation that silently did not happen",
    ),
    ("a-scheduled-run-with-no-human-owner-is-refused", "a named human owner"),
    ("a-scheduled-run-with-a-named-owner-is-allowed", "a documented grant"),
)


class Identity(unittest.TestCase):
    def setUp(self):
        self.act = load_impl(__file__).act

    def go(self, entry, token=None, action=None):
        return self.act(
            token or entry["token"],
            action or entry["action"],
            entry["backends"],
            entry["agentId"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_refused_action_uses_no_scopes(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "refused":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["scopesUsed"], [])
                self.assertTrue(outcome["errors"])

    def test_only_delegation_is_ever_allowed(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        for model in ("service", "impersonation", "delegation"):
            with self.subTest(model):
                outcome = self.go(entry, {**entry["token"], "model": model})
                self.assertEqual(outcome["status"] == "allowed", model == "delegation")

    def test_a_delegation_missing_either_principal_is_refused(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        for field in ("sub", "act"):
            with self.subTest(field):
                outcome = self.go(entry, {**entry["token"], field: None})
                self.assertEqual(outcome["status"], "refused")
                self.assertTrue(
                    any("delegation names no" in e for e in outcome["errors"])
                )

    def test_the_token_carries_exactly_the_scopes_the_backend_needs(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        backend = next(
            b for b in entry["backends"] if b["name"] == entry["action"]["backend"]
        )
        probes = [
            (backend["requiredScopes"], True),
            ([], False),
            (backend["requiredScopes"] + ["hr:read"], False),
            (["hr:read"], False),
        ]
        for scopes, owed in probes:
            with self.subTest(str(scopes)):
                outcome = self.go(entry, {**entry["token"], "scopes": scopes})
                self.assertEqual(outcome["status"] == "allowed", owed)

    def test_a_backend_that_filters_after_reading_is_refused(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        for backend in entry["backends"]:
            with self.subTest(backend["name"]):
                outcome = self.go(
                    entry,
                    {**entry["token"], "scopes": backend["requiredScopes"]},
                    {**entry["action"], "backend": backend["name"]},
                )
                self.assertEqual(
                    outcome["status"] == "refused", backend["filtersOnRead"]
                )

    def test_the_run_holds_a_reference_and_never_a_token(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        stored = self.go(entry, None, {**entry["action"], "storedToken": "eyJ..."})
        self.assertEqual(stored["status"], "refused")
        bare = self.go(entry, None, {**entry["action"], "delegationRef": None})
        self.assertEqual(bare["status"], "refused")

    def test_expiry_is_checked_at_the_moment_of_the_action(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        expiry = entry["token"]["expiresAtMs"]
        for at in (expiry - 1, expiry, expiry + 1):
            with self.subTest(at):
                outcome = self.go(entry, None, {**entry["action"], "atMs": at})
                self.assertEqual(outcome["status"] == "allowed", at < expiry)

    def test_a_scheduled_run_needs_an_owner(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        for scheduled in (True, False):
            for owner in ("human:mlopes", None):
                with self.subTest(f"{scheduled}/{owner}"):
                    outcome = self.go(
                        entry,
                        None,
                        {**entry["action"], "scheduled": scheduled, "ownerHuman": owner},
                    )
                    self.assertEqual(
                        outcome["status"] == "allowed",
                        not scheduled or owner is not None,
                    )

    def test_every_audit_line_names_the_user_agent_and_run(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["log"]["run"], entry["action"]["runId"])
                self.assertEqual(outcome["log"]["user"], entry["token"]["sub"])
                self.assertEqual(
                    outcome["log"]["agent"],
                    entry["token"]["act"] or entry["agentId"],
                )
                if outcome["status"] == "allowed":
                    for value in outcome["log"].values():
                        self.assertTrue(value)

    def test_an_action_missing_part_of_the_audit_line_is_refused(self):
        entry = case(FIXTURE, "a-delegation-names-both-principals-and-is-allowed")
        self.assertEqual(
            self.go(entry, {**entry["token"], "sub": None})["status"], "refused"
        )
        self.assertEqual(
            self.go(entry, None, {**entry["action"], "runId": ""})["status"], "refused"
        )
