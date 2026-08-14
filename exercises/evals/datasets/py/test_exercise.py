import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
BUCKETS = ("production", "adversarial", "constructed", "replay")

CASES = (
    ("a-set-with-all-four-buckets-is-usable", "built on purpose"),
    ("one-golden-set-per-route-not-one-per-application", "a blended score hides a collapse"),
    ("a-missing-bucket-makes-the-set-unusable", "the replay bucket keeps it learning"),
    (
        "a-set-generated-by-the-family-under-test-is-refused",
        "a suspicion about the set first",
    ),
    ("synthesising-the-production-bucket-is-refused", "harvest the centre"),
    ("annotators-who-disagree-are-a-spec-bug", "no definition of success"),
    ("an-unredacted-case-is-a-second-copy-of-customer-data", "a different lifetime"),
    ("a-stale-production-bucket-is-warned-about", "coverage decays quietly"),
    (
        "past-the-ceiling-the-set-is-sampled-rather-than-grown",
        "the constraint is judge cost",
    ),
    (
        "a-rubric-count-that-blows-the-judge-budget-is-refused",
        "sixty thousand calls per run",
    ),
)


class Datasets(unittest.TestCase):
    def setUp(self):
        self.assess = load_impl(__file__).assess

    def go(self, entry, cases=None, policy=None):
        return self.assess(
            entry["cases"] if cases is None else cases, policy or entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_each_route_is_judged_on_its_own(self):
        entry = case(FIXTURE, "one-golden-set-per-route-not-one-per-application")
        outcome = self.go(entry)
        routes = {c["route"] for c in entry["cases"]}
        self.assertEqual(len(outcome["routes"]), len(routes))
        healthy = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        alone = self.go(healthy)["routes"][0]
        together = next(r for r in outcome["routes"] if r["route"] == alone["route"])
        self.assertEqual(together["buckets"], alone["buckets"])
        self.assertEqual(together["errors"], alone["errors"])

    def test_one_bad_route_makes_the_whole_set_unusable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                broken = any(r["errors"] for r in outcome["routes"])
                self.assertEqual(outcome["status"] == "unusable", broken)

    def test_every_required_bucket_must_be_present(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        for bucket in entry["policy"]["requiredBuckets"]:
            with self.subTest(bucket):
                stripped = [c for c in entry["cases"] if c["bucket"] != bucket]
                outcome = self.go(entry, stripped)
                self.assertEqual(outcome["status"], "unusable")
                self.assertTrue(
                    any(
                        bucket in e
                        for r in outcome["routes"]
                        for e in r["errors"]
                    )
                )

    def test_nothing_generated_by_the_family_under_test_is_allowed(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        for item in entry["cases"]:
            with self.subTest(item["id"]):
                poisoned = [
                    {**c, "generatedBy": entry["policy"]["evaluatedFamily"]}
                    if c["id"] == item["id"]
                    else c
                    for c in entry["cases"]
                ]
                self.assertEqual(self.go(entry, poisoned)["status"], "unusable")

    def test_the_production_bucket_is_harvested_and_the_edges_may_be_synthesised(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        for bucket in BUCKETS:
            with self.subTest(bucket):
                flipped = [
                    {**c, "origin": "synthetic", "generatedBy": "other-model"}
                    if c["bucket"] == bucket
                    else c
                    for c in entry["cases"]
                ]
                outcome = self.go(entry, flipped)
                self.assertEqual(
                    outcome["status"] == "unusable", bucket == "production"
                )

    def test_agreement_is_measured_in_basis_points(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        total = len(entry["cases"])
        for agreeing in range(total + 1):
            with self.subTest(agreeing):
                labelled = [
                    {**c, "labels": ["ok", "ok"] if i < agreeing else ["ok", "bad"]}
                    for i, c in enumerate(entry["cases"])
                ]
                report = self.go(entry, labelled)["routes"][0]
                self.assertEqual(
                    report["kappaBps"], int(agreeing * 10000 / total + 0.5)
                )
                self.assertEqual(
                    any("spec bug" in e for e in report["errors"]),
                    report["kappaBps"] < entry["policy"]["minKappaBps"],
                )

    def test_an_unredacted_case_is_refused_wherever_it_sits(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        for item in entry["cases"]:
            with self.subTest(item["id"]):
                leaking = [
                    {**c, "containsPii": True, "redacted": False}
                    if c["id"] == item["id"]
                    else c
                    for c in entry["cases"]
                ]
                self.assertEqual(self.go(entry, leaking)["status"], "unusable")
                redacted = [
                    {**c, "containsPii": True, "redacted": True}
                    if c["id"] == item["id"]
                    else c
                    for c in entry["cases"]
                ]
                self.assertEqual(self.go(entry, redacted)["status"], "usable")

    def test_staleness_warns_without_making_the_set_unusable(self):
        entry = case(FIXTURE, "a-stale-production-bucket-is-warned-about")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "usable")
        self.assertTrue(
            any("newer than" in w for r in outcome["routes"] for w in r["warnings"])
        )

    def test_sampling_caps_the_size_without_dropping_the_route(self):
        entry = case(FIXTURE, "past-the-ceiling-the-set-is-sampled-rather-than-grown")
        report = self.go(entry)["routes"][0]
        self.assertTrue(report["sampled"])
        self.assertEqual(report["size"], entry["policy"]["maxPerRoute"])
        self.assertGreater(len(entry["cases"]), report["size"])
        self.assertTrue(any("sampled down" in w for w in report["warnings"]))

    def test_the_judge_bill_is_size_times_rubrics_and_is_a_hard_budget(self):
        entry = case(FIXTURE, "a-set-with-all-four-buckets-is-usable")
        for rubrics in (1, 4, 8, 12):
            with self.subTest(rubrics):
                outcome = self.go(
                    entry, None, {**entry["policy"], "rubricsPerCase": rubrics}
                )
                report = outcome["routes"][0]
                self.assertEqual(report["judgeCalls"], report["size"] * rubrics)
                self.assertEqual(
                    outcome["status"] == "unusable",
                    report["judgeCalls"] > entry["policy"]["judgeCallBudget"],
                )

    def test_the_bucket_counts_add_up_to_the_whole_route(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for report in self.go(entry)["routes"]:
                    counted = sum(report["buckets"].values())
                    mine = len(
                        [c for c in entry["cases"] if c["route"] == report["route"]]
                    )
                    self.assertEqual(counted, mine)
                    self.assertLessEqual(report["size"], mine)
