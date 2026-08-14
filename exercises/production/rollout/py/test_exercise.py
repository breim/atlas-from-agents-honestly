import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ROLLOUT = FIXTURE["rollout"]

CASES = (
    (
        "a-tenant-inside-the-canary-fraction-gets-the-candidate",
        "the only rung with real risk",
    ),
    ("a-tenant-outside-it-stays-on-stable", "most traffic never notices"),
    ("a-holdout-tenant-is-never-canaried", "the bucket said yes and the holdout won"),
    ("the-canary-boundary-is-exclusive", "the fraction is a fraction"),
    ("a-fresh-run-ignores-a-pinned-bundle", "a new run has nothing to carry"),
    (
        "a-quality-change-resumes-on-the-bundle-it-started-with",
        "the run is half-decided",
    ),
    ("a-bug-fix-migrates-the-run", "the run is currently producing the bug"),
    ("a-policy-change-always-migrates", "old rules must not govern today"),
    (
        "a-run-paused-since-tuesday-acts-under-todays-rules",
        "the prompt is pinned; the policy is not",
    ),
)


class Rollout(unittest.TestCase):
    def setUp(self):
        self.assign = load_impl(__file__).assign

    def run_case(
        self, entry: dict, request: dict = None, rollout: dict = None, change: str = None
    ) -> dict:
        return self.assign(
            request or entry["request"],
            rollout or ROLLOUT,
            change or entry["change"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_policy_version_is_never_the_pinned_one(self):
        for entry in FIXTURE["cases"]:
            for pinned in ("pol-1", "pol-99", None):
                with self.subTest(f"{entry['id']}:{pinned}"):
                    result = self.run_case(
                        entry, {**entry["request"], "pinnedPolicyVersion": pinned}
                    )
                    self.assertEqual(result["policyVersion"], ROLLOUT["policyVersion"])

    def test_a_holdout_tenant_never_receives_the_candidate_on_a_fresh_run(self):
        for bucket in (0, 100, 499, 500, 9999):
            with self.subTest(bucket):
                request = {
                    "tenantId": ROLLOUT["holdout"][0],
                    "bucketBps": bucket,
                    "resuming": False,
                    "pinnedBundleId": None,
                    "pinnedPolicyVersion": None,
                }
                result = self.assign(request, ROLLOUT, "quality")
                self.assertEqual(result["bundleId"], ROLLOUT["stable"])
                self.assertEqual(result["reason"], "holdout")

    def test_the_same_tenant_at_the_same_bucket_lands_the_same_way(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry), self.run_case(entry))
                again = self.run_case(entry, dict(entry["request"]))
                self.assertEqual(again, self.run_case(entry))

    def test_a_fresh_run_never_reads_the_pinned_bundle(self):
        for entry in FIXTURE["cases"]:
            if entry["request"]["resuming"]:
                continue
            for pinned in ("bundle-Z", "bundle-A", None):
                with self.subTest(f"{entry['id']}:{pinned}"):
                    self.assertEqual(
                        self.run_case(
                            entry, {**entry["request"], "pinnedBundleId": pinned}
                        ),
                        self.run_case(entry),
                    )

    def test_a_quality_change_never_migrates_a_resuming_run(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                resuming = {
                    **entry["request"],
                    "resuming": True,
                    "pinnedBundleId": "bundle-A",
                }
                result = self.run_case(entry, resuming, change="quality")
                self.assertEqual(result["bundleId"], "bundle-A")
                self.assertEqual(result["reason"], "pinned_at_start")

    def test_a_bug_fix_or_policy_change_always_migrates(self):
        for entry in FIXTURE["cases"]:
            for change in ("bugfix", "policy"):
                with self.subTest(f"{entry['id']}/{change}"):
                    resuming = {
                        **entry["request"],
                        "resuming": True,
                        "pinnedBundleId": "bundle-A",
                    }
                    result = self.run_case(entry, resuming, change=change)
                    self.assertEqual(result["bundleId"], ROLLOUT["candidate"])

    def test_a_resuming_run_never_re_rolls_the_bucket(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                resuming = {
                    **entry["request"],
                    "resuming": True,
                    "pinnedBundleId": "bundle-A",
                }
                low = self.run_case(entry, {**resuming, "bucketBps": 0})
                high = self.run_case(entry, {**resuming, "bucketBps": 9999})
                self.assertEqual(low, high)

    def test_nobody_at_zero_percent_and_everyone_but_the_holdout_at_a_hundred(self):
        for entry in FIXTURE["cases"]:
            if entry["request"]["resuming"]:
                continue
            with self.subTest(entry["id"]):
                none = self.run_case(
                    entry, rollout={**ROLLOUT, "canaryFractionBps": 0}
                )
                self.assertEqual(none["bundleId"], ROLLOUT["stable"])
                everyone = self.run_case(
                    entry, rollout={**ROLLOUT, "canaryFractionBps": 10000}
                )
                held = entry["request"]["tenantId"] in ROLLOUT["holdout"]
                self.assertEqual(
                    everyone["bundleId"],
                    ROLLOUT["stable"] if held else ROLLOUT["candidate"],
                )

    def test_widening_the_fraction_never_moves_a_tenant_off_the_candidate(self):
        for entry in FIXTURE["cases"]:
            if entry["request"]["resuming"]:
                continue
            if self.run_case(entry)["bundleId"] != ROLLOUT["candidate"]:
                continue
            for fraction in (600, 2000, 10000):
                with self.subTest(f"{entry['id']}:{fraction}"):
                    after = self.run_case(
                        entry, rollout={**ROLLOUT, "canaryFractionBps": fraction}
                    )
                    self.assertEqual(after["bundleId"], ROLLOUT["candidate"])
