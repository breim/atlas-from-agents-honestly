import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]

CASES = (
    (
        "an-unchanged-prompt-replays-the-recorded-response",
        "the recording stands in for the model",
    ),
    ("a-small-wording-change-still-replays", "a tolerance, not an equality check"),
    (
        "a-rebuilt-prompt-is-routed-to-re-run",
        "the recorded answer is to a different question",
    ),
    (
        "a-model-upgrade-makes-every-recording-stale",
        "byte-identical prompts, worthless recording",
    ),
    ("changing-the-effort-is-also-stale", "the other knob, the same problem"),
    (
        "asking-for-more-calls-than-were-recorded-is-exhausted",
        "a call the run never made",
    ),
    (
        "fewer-calls-than-recorded-is-a-clean-replay",
        "the fix short-circuited, and that is fine",
    ),
    ("divergence-stops-at-the-first-bad-step", "nothing is served past the divergence"),
    ("an-empty-replay-has-nothing-to-check", "no calls, no recording needed"),
)


class ReplayDebugging(unittest.TestCase):
    def setUp(self):
        self.replay = load_impl(__file__).replay

    @staticmethod
    def config_for(entry: dict, **overrides) -> dict:
        config = dict(CONFIG)
        if "serving" in entry:
            config["serving"] = entry["serving"]
        config.update(overrides)
        return config

    def run_case(self, entry: dict, **overrides) -> dict:
        return self.replay(
            entry["recording"], entry["requests"], self.config_for(entry, **overrides)
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_different_model_returns_nothing_whatever_the_prompts(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                serving = {
                    **self.config_for(entry)["serving"],
                    "model": "some-other-model",
                }
                self.assertEqual(
                    self.run_case(entry, serving=serving),
                    {"status": "stale", "responses": [], "consumed": 0, "driftBps": []},
                )

    def test_a_different_effort_returns_nothing_whatever_the_prompts(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                serving = {
                    **self.config_for(entry)["serving"],
                    "effort": "some-other-effort",
                }
                self.assertEqual(self.run_case(entry, serving=serving)["status"], "stale")

    def test_consumed_is_exactly_how_many_responses_were_handed_back(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["consumed"], len(result["responses"]))

    def test_every_response_served_is_the_recorded_one_at_that_position(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                responses = self.run_case(entry)["responses"]
                self.assertEqual(
                    responses,
                    [
                        event["response"]
                        for event in entry["recording"]["events"][: len(responses)]
                    ],
                )

    def test_drift_is_zero_exactly_when_the_prompt_matched(self):
        for entry in FIXTURE["cases"]:
            drift_bps = self.run_case(entry)["driftBps"]
            for index, delta in enumerate(drift_bps):
                with self.subTest(f"{entry['id']}:{index}"):
                    identical = (
                        entry["recording"]["events"][index]["prompt"]
                        == entry["requests"][index]
                    )
                    if identical:
                        self.assertEqual(delta, 0)
                    else:
                        self.assertGreater(delta, 0)

    def test_nothing_is_served_past_a_divergence(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["status"] != "diverged":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["consumed"], len(result["driftBps"]) - 1)
                self.assertGreater(result["driftBps"][-1], CONFIG["thresholdBps"])

    def test_a_wider_tolerance_never_serves_fewer_responses(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tight = self.run_case(entry, thresholdBps=0)["consumed"]
                middle = self.run_case(entry)["consumed"]
                wide = self.run_case(entry, thresholdBps=10000)["consumed"]
                self.assertGreaterEqual(middle, tight)
                self.assertGreaterEqual(wide, middle)

    def test_replaying_a_recording_against_its_own_prompts_is_total(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                own = [event["prompt"] for event in entry["recording"]["events"]]
                config = {
                    **self.config_for(entry),
                    "serving": entry["recording"]["serving"],
                }
                result = self.replay(entry["recording"], own, config)
                self.assertEqual(result["status"], "replayed")
                self.assertEqual(
                    result["responses"],
                    [e["response"] for e in entry["recording"]["events"]],
                )
                self.assertTrue(all(delta == 0 for delta in result["driftBps"]))

    def test_drift_does_not_care_which_side_is_the_recording(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                forward = self.run_case(entry)["driftBps"]
                mirrored = self.replay(
                    {
                        "serving": entry["recording"]["serving"],
                        "events": [
                            {"prompt": prompt, "response": "x"}
                            for prompt in entry["requests"]
                        ],
                    },
                    [event["prompt"] for event in entry["recording"]["events"]],
                    self.config_for(entry),
                )["driftBps"]
                self.assertEqual(mirrored[: len(forward)], forward)
