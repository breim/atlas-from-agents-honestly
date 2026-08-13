import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-healthy-stream-never-trips", "healthy traffic is left alone"),
    ("a-partial-window-never-trips", "the first requests are not a signal"),
    ("a-full-window-below-the-floor-trips", "a bad full window fires"),
    ("exactly-at-the-floor-does-not-trip", "the floor comparison is strict"),
    ("an-old-failure-rolls-out-of-the-window", "the window rolls rather than accumulates"),
    (
        "the-guardrail-trips-at-the-first-bad-window-and-stops-looking",
        "the first breach is the breach",
    ),
    ("a-recovery-after-tripping-is-still-a-trip", "a fired guardrail does not un-fire"),
    ("no-traffic-never-trips", "no traffic is no judgement"),
)


class OnlineGuardrail(unittest.TestCase):
    def setUp(self):
        self.watch = load_impl(__file__).watch

    def run_case(self, entry: dict) -> dict:
        return self.watch(entry["outcomes"], FIXTURE["window"], FIXTURE["floorBps"])

    def bps_at(self, outcomes: list, end: int) -> int:
        chunk = outcomes[end - FIXTURE["window"] + 1 : end + 1]
        return chunk.count("ok") * 10000 // FIXTURE["window"]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_stream_shorter_than_the_window_never_trips(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                short = entry["outcomes"][: FIXTURE["window"] - 1]
                result = self.watch(short, FIXTURE["window"], FIXTURE["floorBps"])
                self.assertFalse(result["tripped"])
                self.assertIsNone(result["worstBps"])

    def test_the_trip_index_names_a_full_window_under_the_floor(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["tripped"]:
                continue
            with self.subTest(entry["id"]):
                self.assertGreaterEqual(result["at"], FIXTURE["window"] - 1)
                self.assertLess(
                    self.bps_at(entry["outcomes"], result["at"]), FIXTURE["floorBps"]
                )

    def test_no_window_before_the_trip_was_under_the_floor(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                last = result["at"] if result["tripped"] else len(entry["outcomes"]) - 1
                for end in range(FIXTURE["window"] - 1, last):
                    self.assertGreaterEqual(
                        self.bps_at(entry["outcomes"], end), FIXTURE["floorBps"]
                    )

    def test_a_lower_floor_never_trips_more_often(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["tripped"]:
                continue
            with self.subTest(entry["id"]):
                lenient = self.watch(entry["outcomes"], FIXTURE["window"], 0)
                self.assertFalse(lenient["tripped"])
