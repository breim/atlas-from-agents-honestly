import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("agreement-serves-production-and-records-nothing", "agreement is uneventful"),
    ("a-divergence-is-recorded-and-production-still-serves", "disagreement is recorded, not served"),
    (
        "a-better-looking-candidate-answer-still-does-not-reach-the-user",
        "being right is not a licence to serve",
    ),
    ("a-candidate-that-fails-does-not-affect-the-user", "a broken candidate is invisible to users"),
    ("mixed-traffic-reports-a-partial-agreement-rate", "the rate reflects the mix"),
    ("no-traffic-agrees-vacuously", "no traffic is total agreement"),
)


class ShadowRun(unittest.TestCase):
    def setUp(self):
        self.shadow = load_impl(__file__).shadow

    def run_case(self, entry: dict) -> dict:
        return self.shadow(entry["traffic"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_user_always_receives_production(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                served = self.run_case(entry)["served"]
                for exchange in entry["traffic"]:
                    self.assertEqual(served[exchange["id"]], exchange["production"])

    def test_the_candidate_output_never_appears_in_served(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                served = self.run_case(entry)["served"]
                for exchange in entry["traffic"]:
                    if exchange["candidate"] == exchange["production"]:
                        continue
                    self.assertNotEqual(served[exchange["id"]], exchange["candidate"])

    def test_divergences_are_exactly_the_disagreements(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    self.run_case(entry)["divergences"],
                    [e for e in entry["traffic"] if e["candidate"] != e["production"]],
                )

    def test_agreement_and_divergences_describe_the_same_traffic(self):
        for entry in FIXTURE["cases"]:
            if not entry["traffic"]:
                continue
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                agreed = len(entry["traffic"]) - len(result["divergences"])
                raw = agreed / len(entry["traffic"])
                self.assertEqual(result["agreement"], math.floor(raw * 10000 + 0.5) / 10000)
