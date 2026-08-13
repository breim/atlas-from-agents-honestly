import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-first-delay-is-drawn-from-the-base", "the first window is the base"),
    ("the-window-doubles-each-attempt", "the window grows exponentially"),
    ("the-window-stops-doubling-at-the-cap", "the cap bounds the tail"),
    ("full-jitter-can-draw-zero", "full jitter reaches the bottom of its window"),
    ("jitter-spreads-attempts-across-the-window", "a draw scales with its own window"),
    ("the-delay-is-floored-not-rounded", "the delay never rounds up past its window"),
    ("no-attempts-produce-no-delays", "no attempts is no waiting"),
)


class DelayedRetryJitter(unittest.TestCase):
    def setUp(self):
        self.delays = load_impl(__file__).delays

    def run_case(self, entry: dict) -> list:
        return self.delays(entry["randoms"], FIXTURE["baseMs"], FIXTURE["capMs"])

    def window(self, attempt: int) -> int:
        return min(FIXTURE["baseMs"] * 2**attempt, FIXTURE["capMs"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["delays"])

    def test_one_delay_per_attempt(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(len(self.run_case(entry)), len(entry["randoms"]))

    def test_every_delay_sits_inside_its_own_window(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for index, delay in enumerate(self.run_case(entry)):
                    self.assertGreaterEqual(delay, 0)
                    self.assertLessEqual(delay, self.window(index))

    def test_no_delay_ever_exceeds_the_cap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for delay in self.run_case(entry):
                    self.assertLessEqual(delay, FIXTURE["capMs"])

    def test_a_larger_draw_never_produces_a_smaller_delay(self):
        for entry in FIXTURE["cases"]:
            if not entry["randoms"]:
                continue
            with self.subTest(entry["id"]):
                bigger = self.delays(
                    [min(1, draw + 0.001) for draw in entry["randoms"]],
                    FIXTURE["baseMs"],
                    FIXTURE["capMs"],
                )
                for index, delay in enumerate(self.run_case(entry)):
                    self.assertGreaterEqual(bigger[index], delay)
