import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
THRESHOLDS = FIXTURE["thresholds"]

QUIET = {
    "deployed": False,
    "canaryScoreDeltaBps": 0,
    "citedChunkTurnoverBps": 0,
    "inputCentroidShiftBps": 0,
    "evalScoreDeltaBps": 0,
    "formatComplianceDeltaBps": 0,
}

CASES = (
    ("a-quiet-window-diagnoses-nothing", "nothing moved, nothing to route"),
    ("the-deploy-log-comes-first", "everything is screaming and you still did it"),
    ("a-frozen-canary-that-moved-is-the-provider", "the only variable left"),
    ("input-drift-alone-is-not-an-alert", "traffic changes every week and it is fine"),
    ("an-eval-drop-alone-is-not-an-alert", "noisy on a small sample"),
    ("the-pair-is-the-alert", "the conjunction has the low base rate"),
    (
        "a-re-index-displaced-the-chunk-that-answered-the-question",
        "the real culprit, usually",
    ),
    ("format-compliance-is-the-cheapest-model-tell", "shape moves before quality does"),
    ("a-canary-drop-outranks-a-format-drop", "diagnose the cause, not the symptom"),
    ("a-threshold-reached-exactly-is-reached", "the boundary is inclusive"),
    ("getting-better-is-not-drift", "the deltas are signed"),
)


class Drift(unittest.TestCase):
    def setUp(self):
        self.diagnose = load_impl(__file__).diagnose

    def run_window(self, window: dict, thresholds: dict = None) -> dict:
        return self.diagnose(window, thresholds or THRESHOLDS)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_window(entry["window"]), entry["result"])

    def test_a_deploy_in_the_window_outranks_every_other_signal(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shipped = self.run_window({**entry["window"], "deployed": True})
                self.assertEqual(shipped["cause"], "check_the_deploy_log")
                self.assertIn("deploy", shipped["tripped"])

    def test_a_cause_is_never_reported_without_a_signal(self):
        for entry in FIXTURE["cases"]:
            result = self.run_window(entry["window"])
            if result["cause"] is None:
                continue
            with self.subTest(entry["id"]):
                self.assertTrue(result["tripped"])

    def test_tripped_names_exactly_the_signals_past_their_thresholds(self):
        t = THRESHOLDS
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                w = entry["window"]
                owed = [
                    name
                    for name, fired in (
                        ("deploy", w["deployed"]),
                        ("canary", w["canaryScoreDeltaBps"] <= -t["canaryDropBps"]),
                        (
                            "chunk_turnover",
                            w["citedChunkTurnoverBps"] >= t["chunkTurnoverBps"],
                        ),
                        (
                            "input_centroid",
                            w["inputCentroidShiftBps"] >= t["centroidShiftBps"],
                        ),
                        ("eval_score", w["evalScoreDeltaBps"] <= -t["evalDropBps"]),
                        (
                            "format_compliance",
                            w["formatComplianceDeltaBps"] <= -t["formatDropBps"],
                        ),
                    )
                    if fired
                ]
                self.assertEqual(self.run_window(w)["tripped"], owed)

    def test_input_drift_on_its_own_never_raises_a_cause(self):
        for shift in (1500, 2500, 9999):
            with self.subTest(shift):
                result = self.run_window({**QUIET, "inputCentroidShiftBps": shift})
                self.assertIsNone(result["cause"])
                self.assertEqual(result["tripped"], ["input_centroid"])

    def test_the_joint_alert_needs_both_halves(self):
        for entry in FIXTURE["cases"]:
            if self.run_window(entry["window"])["cause"] != "input_distribution_changed":
                continue
            with self.subTest(entry["id"]):
                half = self.run_window({**entry["window"], "inputCentroidShiftBps": 0})
                self.assertNotEqual(half["cause"], "input_distribution_changed")
                other = self.run_window({**entry["window"], "evalScoreDeltaBps": 0})
                self.assertNotEqual(other["cause"], "input_distribution_changed")

    def test_an_improvement_in_any_signal_never_trips_it(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                w = entry["window"]
                better = {
                    **w,
                    "canaryScoreDeltaBps": abs(w["canaryScoreDeltaBps"]),
                    "evalScoreDeltaBps": abs(w["evalScoreDeltaBps"]),
                    "formatComplianceDeltaBps": abs(w["formatComplianceDeltaBps"]),
                }
                tripped = self.run_window(better)["tripped"]
                for name in ("canary", "eval_score", "format_compliance"):
                    self.assertNotIn(name, tripped)

    def test_raising_a_threshold_never_adds_a_trip(self):
        relaxed = {key: 100000 for key in THRESHOLDS}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                loose = self.run_window(entry["window"], relaxed)["tripped"]
                tight = self.run_window(entry["window"])["tripped"]
                for name in loose:
                    self.assertIn(name, tight)

    def test_a_moved_canary_outranks_everything_except_the_deploy_log(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                upstream = self.run_window(
                    {**entry["window"], "deployed": False, "canaryScoreDeltaBps": -100000}
                )
                self.assertEqual(upstream["cause"], "provider_behavior_changed")
