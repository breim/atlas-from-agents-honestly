import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-bucket-starts-full", "a cold limiter does not throttle the first request"),
    ("a-burst-past-capacity-is-shed", "the burst allowance has an edge"),
    ("waiting-refills-the-bucket", "a full refill period buys one request"),
    ("a-partial-refill-is-not-a-whole-token", "half a token is not a token"),
    ("refill-is-capped-at-capacity", "idling does not bank unlimited credit"),
    ("a-steady-rate-inside-the-limit-never-sheds", "traffic under the rate always passes"),
    ("no-requests-are-neither-admitted-nor-shed", "no traffic is no decisions"),
)


class DownstreamRateLimiting(unittest.TestCase):
    def setUp(self):
        self.admit = load_impl(__file__).admit

    def run_case(self, entry: dict) -> dict:
        return self.admit(entry["arrivals"], FIXTURE["capacity"], FIXTURE["refillMsPerToken"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_request_is_either_admitted_or_shed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    len(result["admitted"]) + len(result["rejected"]), len(entry["arrivals"])
                )

    def test_no_window_admits_more_than_the_bucket_could_hold(self):
        for entry in FIXTURE["cases"]:
            admitted = self.run_case(entry)["admitted"]
            if not admitted:
                continue
            with self.subTest(entry["id"]):
                span = admitted[-1] - admitted[0]
                affordable = FIXTURE["capacity"] + span / FIXTURE["refillMsPerToken"]
                self.assertLessEqual(len(admitted), affordable)

    def test_a_stricter_capacity_never_admits_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                strict = self.admit(
                    entry["arrivals"], FIXTURE["capacity"] - 1, FIXTURE["refillMsPerToken"]
                )
                self.assertLessEqual(
                    len(strict["admitted"]), len(self.run_case(entry)["admitted"])
                )
