import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
LADDER = FIXTURE["ladder"]

CASES = (
    ("the-primary-answers-and-nothing-degrades", "the ordinary path"),
    ("a-transient-failure-walks-down-the-ladder", "and the response says so"),
    (
        "an-open-breaker-is-skipped-without-being-tried",
        "a dependency you believe is broken",
    ),
    ("a-refusal-does-not-shop-for-another-provider", "that is not what a fallback is for"),
    (
        "a-malformed-request-fails-again-everywhere",
        "the second attempt is the first attempt",
    ),
    (
        "high-stakes-work-is-not-allowed-to-degrade",
        "escalate rather than accept the cheap rung",
    ),
    ("tier-zero-work-may-use-the-cheap-rungs", "the same failures, a different answer"),
    (
        "the-rungs-that-need-nobody-elses-capacity",
        "everyone secondary is the same secondary",
    ),
    ("only-a-person-can-take-the-highest-tier", "the rung available at any tier"),
    ("an-exhausted-ladder-is-an-escalation-not-a-500", "a person is a correct outcome"),
)


def rung_of(name: str) -> dict:
    return next(rung for rung in LADDER if rung["name"] == name)


class FallbacksAndBreakers(unittest.TestCase):
    def setUp(self):
        self.serve = load_impl(__file__).serve

    @staticmethod
    def request_of(entry: dict, **overrides) -> dict:
        return {
            "tier": entry["tier"],
            "open": entry["open"],
            "behaviour": entry["behaviour"],
            **overrides,
        }

    def run_case(self, entry: dict, **overrides) -> dict:
        return self.serve(self.request_of(entry, **overrides), LADDER)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_rung_with_an_open_breaker_is_never_called(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for name in entry["open"]:
                    self.assertNotIn(name, result["attempted"])
                    for item in result["skipped"]:
                        if item["name"] == name:
                            self.assertEqual(item["why"], "breaker_open")

    def test_a_rung_is_never_called_above_the_tier_it_may_serve(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for name in self.run_case(entry)["attempted"]:
                    self.assertGreaterEqual(rung_of(name)["maxTier"], entry["tier"])

    def test_the_serving_rung_could_serve_this_tier(self):
        for entry in FIXTURE["cases"]:
            served_by = self.run_case(entry)["servedBy"]
            if served_by is None:
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(rung_of(served_by)["maxTier"], entry["tier"])

    def test_degraded_is_true_exactly_when_a_later_rung_answered(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                later = (
                    result["servedBy"] is not None
                    and result["servedBy"] != LADDER[0]["name"]
                )
                self.assertEqual(result["degraded"], later)

    def test_a_non_transient_failure_halts_the_ladder(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["outcome"] != "halted":
                continue
            with self.subTest(entry["id"]):
                last = result["attempted"][-1]
                self.assertEqual(entry["behaviour"][last], result["error"])
                index = next(i for i, r in enumerate(LADDER) if r["name"] == last)
                for rung in LADDER[index + 1 :]:
                    self.assertNotIn(rung["name"], result["attempted"])

    def test_a_refusal_at_the_first_rung_is_never_a_fallback(self):
        for entry in FIXTURE["cases"]:
            if entry["tier"] > LADDER[0]["maxTier"]:
                continue
            for failure in ("policy", "permanent"):
                with self.subTest(f"{entry['id']}/{failure}"):
                    refused = self.run_case(
                        entry,
                        open=[],
                        behaviour={**entry["behaviour"], "primary": failure},
                    )
                    self.assertEqual(refused["attempted"], ["primary"])
                    self.assertIsNone(refused["servedBy"])
                    self.assertEqual(refused["error"], failure)

    def test_a_served_response_always_names_a_rung_and_nothing_else_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    result["servedBy"] is not None, result["outcome"] == "served"
                )

    def test_every_rung_is_visited_at_most_once_in_ladder_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                touched = result["attempted"] + [s["name"] for s in result["skipped"]]
                self.assertEqual(len(set(touched)), len(touched))

    def test_opening_every_breaker_escalates_without_calling_anything(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shut = self.run_case(entry, open=[r["name"] for r in LADDER])
                self.assertEqual(shut["outcome"], "escalate")
                self.assertEqual(shut["attempted"], [])
                self.assertEqual(shut["error"], "no_capacity")
