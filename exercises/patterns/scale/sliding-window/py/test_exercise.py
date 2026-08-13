import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-inside-the-window-is-kept", "recent events stay"),
    ("an-event-older-than-the-window-falls-out", "old events leave"),
    ("the-edge-of-the-window-is-inclusive", "exactly at the edge is inside"),
    ("one-millisecond-past-the-edge-falls-out", "one millisecond older is outside"),
    ("kept-events-hold-their-original-order", "the window filters, it does not sort"),
    ("an-event-in-the-future-is-kept", "forward clock skew is not stale"),
    ("everything-can-fall-out", "an empty window is a valid answer"),
    ("an-empty-window-keeps-nothing", "no events is no events"),
)


class SlidingWindow(unittest.TestCase):
    def setUp(self):
        self.window = load_impl(__file__).window

    def run_case(self, entry: dict) -> list:
        return self.window(entry["events"], entry["now"], FIXTURE["windowMs"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["kept"])

    def test_the_window_only_filters(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)
                all_ids = [event["id"] for event in entry["events"]]
                self.assertEqual([i for i in all_ids if i in kept], kept)

    def test_nothing_outside_survives_and_nothing_inside_is_dropped(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = set(self.run_case(entry))
                for event in entry["events"]:
                    inside = event["at"] >= entry["now"] - FIXTURE["windowMs"]
                    self.assertEqual(event["id"] in kept, inside)

    def test_a_wider_window_never_keeps_less(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                wider = self.window(entry["events"], entry["now"], FIXTURE["windowMs"] * 2)
                self.assertGreaterEqual(len(wider), len(self.run_case(entry)))
