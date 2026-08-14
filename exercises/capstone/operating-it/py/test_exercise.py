import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-good-rollout-is-anticlimactic", "one number in a manifest"),
    (
        "a-rollout-touching-several-fields-is-not-reversible-in-seconds",
        "reversible in seconds",
    ),
    ("discarding-the-previous-index-removes-the-fast-fix", "decided months earlier"),
    ("a-canary-read-on-dashboards-finds-nothing", "forty escalations, read"),
    ("a-canary-too-short-to-read-is-not-a-canary", "week one is for reading"),
    (
        "a-metric-that-moved-because-its-definition-was-wrong-is-warned",
        "the definition, not the code",
    ),
    ("an-incident-that-skipped-the-fallback-is-not-unremarkable", "six steps"),
    ("a-drill-with-no-human-consequence-missed-the-queue", "the queue when gating triples"),
    ("drift-diagnosis-missing-a-query-has-no-time-to-report", "four queries, nine minutes"),
    ("a-ledger-whose-misses-do-not-add-up-is-not-honest", "separated by cause"),
    ("a-ledger-that-under-reports-its-misses-is-not-honest", "including the misses"),
)


class OperatingIt(unittest.TestCase):
    def setUp(self):
        self.operate = load_impl(__file__).operate

    def go(self, entry, rollout=None, signals=None, incident=None, drift=None, ledger=None):
        return self.operate(
            rollout or entry["rollout"],
            signals if signals is not None else entry["signals"],
            incident or entry["incident"],
            drift or entry["drift"],
            ledger or entry["ledger"],
            entry["policy"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_rollout_is_reversible_only_when_small_and_retained(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        for fields in (1, 2):
            for retained in (True, False):
                with self.subTest(f"{fields}/{retained}"):
                    rollout = {
                        **entry["rollout"],
                        "changedFields": [f"f{i}" for i in range(fields)],
                        "previousIndexRetained": retained,
                    }
                    outcome = self.go(entry, rollout)
                    owed = fields <= entry["policy"]["maxChangedFields"] and retained
                    self.assertEqual(outcome["reversibleInSeconds"], owed)
                    self.assertEqual(outcome["status"] == "operable", owed)

    def test_the_canary_must_be_long_enough_and_read_by_a_person(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        minimum = entry["policy"]["minCanaryDays"]
        for days in (minimum - 1, minimum, minimum + 1):
            with self.subTest(days):
                outcome = self.go(entry, {**entry["rollout"], "canaryDays": days})
                self.assertEqual(outcome["status"] == "operable", days >= minimum)
        dashboards = self.go(
            entry, {**entry["rollout"], "canaryReviewedBy": "dashboards"}
        )
        self.assertEqual(dashboards["status"], "not-operable")

    def test_a_moved_definition_warns_and_an_implementation_does_not(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        for kind in ("definition", "implementation"):
            for moved in (True, False):
                with self.subTest(f"{kind}/{moved}"):
                    outcome = self.go(
                        entry, None, [{"name": "probe", "kind": kind, "moved": moved}]
                    )
                    self.assertEqual(
                        bool(outcome["warnings"]), moved and kind == "definition"
                    )
                    self.assertEqual(outcome["status"], "operable")

    def test_every_incident_step_is_required(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        for step in entry["policy"]["incidentSteps"]:
            with self.subTest(step):
                incident = {**entry["incident"], step: False}
                outcome = self.go(entry, None, None, incident)
                self.assertEqual(outcome["status"], "not-operable")
                self.assertTrue(any(step in e for e in outcome["errors"]))

    def test_the_human_consequence_is_a_step_of_its_own(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        outcome = self.go(
            entry, None, None, {**entry["incident"], "humanConsequenceInjected": False}
        )
        self.assertEqual(outcome["status"], "not-operable")
        self.assertTrue(any("human consequence" in e for e in outcome["errors"]))

    def test_drift_is_diagnosable_only_with_all_four_queries(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        queries = entry["policy"]["driftQueries"]
        for query in queries:
            with self.subTest(query):
                outcome = self.go(
                    entry,
                    None,
                    None,
                    None,
                    {"queriesRun": [q for q in queries if q != query]},
                )
                self.assertIsNone(outcome["driftMinutes"])
                self.assertEqual(outcome["status"], "not-operable")
        self.assertGreater(self.go(entry)["driftMinutes"], 0)

    def test_the_ledger_adds_up_in_both_directions(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        base = entry["ledger"]
        misses = base["claimed"] - base["hit"]
        probes = {
            "honest": base,
            "under-reported": {**base, "missesReported": misses - 1},
            "miscategorised": {
                **base,
                "structuralMisses": base["structuralMisses"] + 1,
            },
            "over-reported": {**base, "missesReported": misses + 1},
        }
        for name, ledger in probes.items():
            with self.subTest(name):
                outcome = self.go(entry, None, None, None, None, ledger)
                self.assertEqual(outcome["ledgerHonest"], name == "honest")
                self.assertEqual(outcome["status"] == "operable", name == "honest")

    def test_known_cause_and_structural_misses_are_counted_separately(self):
        entry = case(FIXTURE, "a-good-rollout-is-anticlimactic")
        ledger = entry["ledger"]
        self.assertGreater(ledger["structuralMisses"], 0)
        self.assertGreater(ledger["knownCauseMisses"], 0)
        self.assertEqual(
            ledger["structuralMisses"] + ledger["knownCauseMisses"],
            ledger["claimed"] - ledger["hit"],
        )
        self.assertTrue(self.go(entry)["ledgerHonest"])

    def test_a_report_that_is_not_operable_says_every_reason(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["status"] == "not-operable", bool(outcome["errors"])
                )
