import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-tightly-scoped-grant-with-an-in-scope-call-is-clean", "six axes, not one"),
    ("an-unused-grant-is-reachable-now-that-a-model-chooses", "latent is no longer latent"),
    ("a-grant-scoped-only-by-tool-is-a-finding", "most use only the second"),
    ("a-per-call-cap-without-a-per-run-cap-misses-the-slow-attack", "twenty small credits"),
    ("twenty-small-credits-are-stopped-by-the-aggregate-cap", "the aggregate holds"),
    ("a-write-bound-to-an-entity-not-in-scope-is-refused", "from your records"),
    ("a-tool-that-appeared-after-the-audit-is-denied-by-default", "a dynamic catalogue"),
    ("unattended-execution-is-a-permission-the-task-did-not-need", "least agency"),
    ("a-standing-credential-cannot-answer-which-run-caused-what", "the run id in the token"),
    ("shadow-mode-measures-the-policy-without-blocking-anything", "a week before"),
)


class LeastPrivilege(unittest.TestCase):
    def setUp(self):
        self.govern = load_impl(__file__).govern

    def go(self, entry, grants=None, run=None, policy=None):
        return self.govern(
            grants or entry["grants"], run or entry["run"], policy or entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_unused_grant_is_a_finding(self):
        entry = case(FIXTURE, "a-tightly-scoped-grant-with-an-in-scope-call-is-clean")
        for grant in entry["grants"]:
            with self.subTest(grant["tool"]):
                stale = [
                    {**g, "usedInLast90Days": False} if g["tool"] == grant["tool"] else g
                    for g in entry["grants"]
                ]
                outcome = self.go(entry, stale)
                self.assertEqual(outcome["status"], "findings")
                self.assertTrue(
                    any(f.startswith(grant["tool"]) for f in outcome["findings"])
                )

    def test_every_required_scope_is_required(self):
        entry = case(FIXTURE, "a-tightly-scoped-grant-with-an-in-scope-call-is-clean")
        for scope in entry["policy"]["requiredScopes"]:
            with self.subTest(scope):
                narrowed = [
                    {**g, "argumentScopes": [s for s in g["argumentScopes"] if s != scope]}
                    for g in entry["grants"]
                ]
                outcome = self.go(entry, narrowed)
                self.assertEqual(outcome["status"], "findings")
                self.assertTrue(any(scope in f for f in outcome["findings"]))

    def test_a_call_is_allowed_only_when_its_entity_is_in_scope(self):
        entry = case(FIXTURE, "a-tightly-scoped-grant-with-an-in-scope-call-is-clean")
        for entity in ("order:4921", "order:9999", "account:4471"):
            with self.subTest(entity):
                outcome = self.go(
                    entry,
                    None,
                    {
                        **entry["run"],
                        "calls": [
                            {"tool": "issue_credit", "entity": entity, "amountCents": 1000}
                        ],
                    },
                )
                owed = entity in entry["run"]["entitiesInScope"]
                self.assertEqual(outcome["decisions"][0]["allowed"], owed)
                self.assertEqual(outcome["spentCents"], 1000 if owed else 0)

    def test_the_aggregate_cap_stops_what_per_call_caps_let_through(self):
        entry = case(FIXTURE, "twenty-small-credits-are-stopped-by-the-aggregate-cap")
        grant = next(g for g in entry["grants"] if g["tool"] == "issue_credit")
        outcome = self.go(entry)
        for call in entry["run"]["calls"]:
            self.assertLessEqual(call["amountCents"], grant["maxPerCall"])
        self.assertGreater(outcome["blocked"], 0)
        self.assertLessEqual(outcome["spentCents"], grant["maxPerRun"])

    def test_spend_never_exceeds_the_aggregate_cap(self):
        entry = case(FIXTURE, "twenty-small-credits-are-stopped-by-the-aggregate-cap")
        grant = next(g for g in entry["grants"] if g["tool"] == "issue_credit")
        for size in (10000, 50000, 150000, 199999):
            with self.subTest(size):
                calls = [
                    {"tool": "issue_credit", "entity": "order:4921", "amountCents": size}
                    for _ in range(40)
                ]
                outcome = self.go(entry, None, {**entry["run"], "calls": calls})
                self.assertLessEqual(outcome["spentCents"], grant["maxPerRun"])

    def test_a_newly_appeared_tool_is_denied(self):
        entry = case(FIXTURE, "a-tool-that-appeared-after-the-audit-is-denied-by-default")
        outcome = self.go(entry)
        index = next(
            i for i, c in enumerate(entry["run"]["calls"]) if c["tool"] == "new_tool"
        )
        self.assertFalse(outcome["decisions"][index]["allowed"])
        self.assertTrue(any("new_tool" in f for f in outcome["findings"]))

    def test_unattended_is_a_finding_only_on_an_unattended_run(self):
        entry = case(FIXTURE, "a-tightly-scoped-grant-with-an-in-scope-call-is-clean")
        for unattended in (True, False):
            for attended in (True, False):
                with self.subTest(f"{unattended}/{attended}"):
                    grants = [{**g, "unattended": unattended} for g in entry["grants"]]
                    outcome = self.go(
                        entry, grants, {**entry["run"], "attended": attended}
                    )
                    owed = unattended and not attended
                    self.assertEqual(
                        any("unattended" in f for f in outcome["findings"]), owed
                    )

    def test_a_denial_escalates_whether_or_not_it_blocks(self):
        for entry in FIXTURE["cases"]:
            for mode in ("shadow", "enforce"):
                with self.subTest(f"{entry['id']}/{mode}"):
                    outcome = self.go(entry, None, None, {**entry["policy"], "mode": mode})
                    enforced = self.go(
                        entry, None, None, {**entry["policy"], "mode": "enforce"}
                    )
                    refused = len(
                        [d for d in enforced["decisions"] if not d["allowed"]]
                    )
                    self.assertEqual(outcome["escalated"], refused)
                    self.assertEqual(
                        outcome["blocked"], 0 if mode == "shadow" else refused
                    )

    def test_shadow_mode_changes_only_what_is_blocked(self):
        entry = case(FIXTURE, "shadow-mode-measures-the-policy-without-blocking-anything")
        shadow = self.go(entry, None, None, {**entry["policy"], "mode": "shadow"})
        enforce = self.go(entry, None, None, {**entry["policy"], "mode": "enforce"})
        self.assertEqual(shadow["findings"], enforce["findings"])
        self.assertEqual(shadow["escalated"], enforce["escalated"])
        self.assertEqual(shadow["blocked"], 0)
        self.assertGreater(enforce["blocked"], 0)
        self.assertTrue(all(d["allowed"] for d in shadow["decisions"]))

    def test_a_standing_credential_is_always_a_finding(self):
        for entry in FIXTURE["cases"]:
            for credential in ("standing", "run-scoped"):
                with self.subTest(f"{entry['id']}/{credential}"):
                    outcome = self.go(
                        entry, None, {**entry["run"], "credential": credential}
                    )
                    self.assertEqual(
                        any("standing credential" in f for f in outcome["findings"]),
                        credential == "standing",
                    )

    def test_a_refused_call_never_spends_and_never_stops_the_next(self):
        entry = case(FIXTURE, "a-tightly-scoped-grant-with-an-in-scope-call-is-clean")
        calls = [
            {"tool": "issue_credit", "entity": "order:9999", "amountCents": 1000},
            {"tool": "issue_credit", "entity": "order:4921", "amountCents": 2000},
        ]
        outcome = self.go(entry, None, {**entry["run"], "calls": calls})
        self.assertFalse(outcome["decisions"][0]["allowed"])
        self.assertTrue(outcome["decisions"][1]["allowed"])
        self.assertEqual(outcome["spentCents"], 2000)
