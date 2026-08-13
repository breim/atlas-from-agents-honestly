import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-healthy-tool-is-never-tripped", "a working tool keeps working"),
    ("failures-below-the-threshold-do-not-open-it", "a couple of failures is not an outage"),
    ("a-success-resets-the-failure-count", "the threshold counts consecutive failures"),
    ("the-threshold-opens-the-breaker", "enough consecutive failures trips it"),
    ("an-open-breaker-short-circuits-without-calling", "an open breaker sends no traffic"),
    ("the-cooldown-lets-one-probe-through", "recovery is discovered by a single probe"),
    ("a-failed-probe-opens-the-breaker-again", "a failed probe restarts the cooldown"),
    ("no-calls-leave-the-breaker-closed", "no traffic is no state"),
)


class ToolCircuitBreaker(unittest.TestCase):
    def setUp(self):
        self.run = load_impl(__file__).run

    def execute(self, entry: dict) -> dict:
        return self.run(entry["calls"], FIXTURE["threshold"], FIXTURE["cooldownMs"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.execute(entry), entry["result"])

    def test_open_calls_never_reach_and_others_always_do(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.execute(entry)
                should_reach = [
                    call["at"]
                    for call, state in zip(entry["calls"], result["states"])
                    if state != "open"
                ]
                self.assertEqual(result["reached"], should_reach)

    def test_one_state_per_call(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(len(self.execute(entry)["states"]), len(entry["calls"]))

    def test_a_half_open_probe_only_follows_an_open_breaker(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                states = self.execute(entry)["states"]
                for index, state in enumerate(states):
                    if state != "half-open":
                        continue
                    self.assertGreater(index, 0)

    def test_the_breaker_only_opens_after_the_threshold(self):
        for entry in FIXTURE["cases"]:
            states = self.execute(entry)["states"]
            if "open" not in states:
                continue
            with self.subTest(entry["id"]):
                first_open = states.index("open")
                prior = [c for c in entry["calls"][:first_open] if c["outcome"] == "fail"]
                self.assertGreaterEqual(len(prior), FIXTURE["threshold"])
