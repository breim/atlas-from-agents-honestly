import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("invariants-gate-and-rates-report", "no threshold, no re-runs"),
    (
        "a-dataset-with-no-negatives-throws-away-its-only-deterministic-assertions",
        "take every one",
    ),
    (
        "a-dataset-that-never-promotes-a-failure-has-stopped-learning",
        "growth at the rate it breaks",
    ),
    ("a-rate-gated-as-if-it-were-an-invariant-is-refused", "re-run until it passes"),
    ("an-invariant-carrying-a-threshold-is-refused", "an invariant has no threshold"),
    ("three-gated-rates-blow-the-flake-budget", "false alarms by construction"),
    ("a-trace-missing-one-of-the-four-fields-is-soft", "demanded by three chapters each"),
    (
        "a-suite-with-no-approval-fast-forward-injection-is-soft",
        "found by a customer otherwise",
    ),
    ("a-security-review-against-the-design-is-not-a-review", "against the built system"),
)


class HardeningIt(unittest.TestCase):
    def setUp(self):
        self.harden = load_impl(__file__).harden

    def go(self, entry, suite=None):
        return self.harden(suite or entry["suite"], entry["policy"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_dataset_source_is_required(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for source in entry["policy"]["requiredSources"]:
            with self.subTest(source):
                dataset = {**entry["suite"]["dataset"], source: 0}
                outcome = self.go(entry, {**entry["suite"], "dataset": dataset})
                self.assertEqual(outcome["status"], "soft")
                self.assertTrue(any(source in e for e in outcome["errors"]))

    def test_an_invariant_gates_and_a_rate_never_does(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for kind in ("invariant", "rate"):
            with self.subTest(kind):
                criteria = [
                    {"name": "probe", "kind": kind, "gated": True, "threshold": None}
                ]
                outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
                self.assertEqual(outcome["status"] == "hardened", kind == "invariant")
                self.assertEqual(
                    outcome["gated"], ["probe"] if kind == "invariant" else []
                )

    def test_an_invariant_carrying_a_threshold_is_a_category_error(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for threshold in (None, 0, 9900):
            with self.subTest(str(threshold)):
                criteria = [
                    {
                        "name": "probe",
                        "kind": "invariant",
                        "gated": True,
                        "threshold": threshold,
                    }
                ]
                outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
                self.assertEqual(outcome["status"] == "hardened", threshold is None)

    def test_the_flake_budget_is_spent_only_by_gated_rates(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        rate = entry["policy"]["rateFalseAlarmBps"]
        invariants = [c for c in entry["suite"]["criteria"] if c["kind"] == "invariant"]
        for count in (0, 1, 2, 3):
            with self.subTest(count):
                criteria = invariants + [
                    {"name": f"r{i}", "kind": "rate", "gated": True, "threshold": 5000}
                    for i in range(count)
                ]
                outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
                self.assertEqual(outcome["flakeSpendBps"], count * rate)
        only = self.go(entry, {**entry["suite"], "criteria": invariants})
        self.assertEqual(only["flakeSpendBps"], 0)

    def test_the_flake_budget_is_a_hard_limit(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        rate = entry["policy"]["rateFalseAlarmBps"]
        budget = entry["policy"]["flakeBudgetBps"]
        for count in (0, 1, 2, 3, 4):
            with self.subTest(count):
                criteria = [
                    {"name": f"r{i}", "kind": "rate", "gated": True, "threshold": 5000}
                    for i in range(count)
                ]
                outcome = self.go(entry, {**entry["suite"], "criteria": criteria})
                self.assertEqual(
                    any("bps against a budget" in e for e in outcome["errors"]),
                    count * rate > budget,
                )

    def test_every_criterion_is_gated_or_reported(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                seen = outcome["gated"] + outcome["reported"]
                self.assertEqual(len(set(seen)), len(seen))
                for criterion in entry["suite"]["criteria"]:
                    if criterion["name"] in seen:
                        continue
                    self.assertTrue(
                        any(e.startswith(criterion["name"]) for e in outcome["errors"])
                    )

    def test_every_required_trace_field_is_required(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for field in entry["policy"]["requiredTraceFields"]:
            with self.subTest(field):
                fields = [f for f in entry["suite"]["traceFields"] if f != field]
                outcome = self.go(entry, {**entry["suite"], "traceFields": fields})
                self.assertEqual(outcome["status"], "soft")
                self.assertTrue(any(field in e for e in outcome["errors"]))

    def test_every_required_injection_is_required(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for injection in entry["policy"]["requiredInjections"]:
            with self.subTest(injection):
                injections = [
                    i for i in entry["suite"]["injections"] if i != injection
                ]
                outcome = self.go(entry, {**entry["suite"], "injections": injections})
                self.assertEqual(outcome["status"], "soft")
                self.assertTrue(any(injection in e for e in outcome["errors"]))

    def test_the_dataset_size_is_the_sum_of_its_buckets(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owed = sum(entry["suite"]["dataset"].values())
                self.assertEqual(self.go(entry)["datasetSize"], owed)

    def test_the_review_must_run_against_what_was_built(self):
        entry = case(FIXTURE, "invariants-gate-and-rates-report")
        for reviewed in ("built-system", "design"):
            with self.subTest(reviewed):
                outcome = self.go(entry, {**entry["suite"], "reviewedAgainst": reviewed})
                self.assertEqual(
                    outcome["status"] == "hardened", reviewed == "built-system"
                )

    def test_a_soft_suite_names_every_reason(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["status"] == "soft", bool(outcome["errors"]))
