import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = {key: FIXTURE[key] for key in ("baseline", "tolerance", "minSamples")}
RANK = {"rollback": 0, "hold": 1, "promote": 2}

CASES = (
    ("too-few-samples-holds-whatever-the-rate", "a great rate on no data is still no data"),
    (
        "too-few-samples-holds-even-when-the-rate-is-terrible",
        "a bad rate on no data is also no data",
    ),
    ("matching-the-baseline-promotes", "parity is good enough to ship"),
    ("beating-the-baseline-promotes", "better than parity certainly is"),
    ("a-small-regression-inside-tolerance-holds", "a mild regression is neither ship nor revert"),
    ("exactly-at-the-tolerance-floor-holds", "the floor is inclusive"),
    ("past-the-tolerance-floor-rolls-back", "one basis point past the floor reverts"),
    ("exactly-at-the-sample-floor-is-enough-evidence", "the sample floor is inclusive too"),
)


class CanaryEval(unittest.TestCase):
    def setUp(self):
        self.decide = load_impl(__file__).decide

    def run_case(self, entry: dict) -> dict:
        return self.decide(entry["samples"], entry["rate"], POLICY)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["decision"])

    def test_nothing_is_acted_on_below_the_sample_floor(self):
        for entry in FIXTURE["cases"]:
            if entry["samples"] >= POLICY["minSamples"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry)["action"], "hold")

    def test_promotion_only_at_or_above_the_baseline(self):
        for entry in FIXTURE["cases"]:
            if self.run_case(entry)["action"] != "promote":
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(entry["rate"], POLICY["baseline"])

    def test_rollback_only_past_the_tolerance_floor(self):
        for entry in FIXTURE["cases"]:
            if self.run_case(entry)["action"] != "rollback":
                continue
            with self.subTest(entry["id"]):
                self.assertLess(entry["rate"], POLICY["baseline"] - POLICY["tolerance"])

    def test_a_better_rate_never_produces_a_worse_action(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                better = self.decide(entry["samples"], entry["rate"] + 1, POLICY)
                self.assertGreaterEqual(
                    RANK[better["action"]], RANK[self.run_case(entry)["action"]]
                )
