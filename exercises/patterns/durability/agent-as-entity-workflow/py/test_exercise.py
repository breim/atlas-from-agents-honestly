import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-entity-accumulates-state-across-signals", "state survives from signal to signal"),
    ("a-replayed-signal-is-applied-once", "a redelivery does not double the state"),
    ("deduplication-is-by-id-not-by-content", "two real events with equal payloads both count"),
    ("a-duplicate-id-with-different-content-is-still-a-duplicate", "the first delivery wins"),
    ("a-duplicate-arriving-much-later-is-still-caught", "the entity remembers for its whole life"),
    ("an-unknown-kind-is-ignored-without-failing-the-entity", "one bad signal is not an outage"),
    ("an-entity-with-no-signals-is-still-a-valid-entity", "an empty entity is a valid entity"),
)


class AgentAsEntityWorkflow(unittest.TestCase):
    def setUp(self):
        self.apply = load_impl(__file__).apply

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.apply(entry["signals"]), entry["result"])

    def test_every_signal_is_either_applied_or_ignored(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.apply(entry["signals"])
                self.assertEqual(
                    len(result["applied"]) + len(result["ignored"]), len(entry["signals"])
                )

    def test_no_id_is_applied_more_than_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                applied = self.apply(entry["signals"])["applied"]
                self.assertEqual(len(set(applied)), len(applied))

    def test_the_state_holds_one_note_per_applied_signal(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.apply(entry["signals"])
                self.assertEqual(len(result["notes"]), len(result["applied"]))
                first_values = [
                    next(s["value"] for s in entry["signals"] if s["id"] == signal_id)
                    for signal_id in result["applied"]
                ]
                self.assertEqual(result["notes"], first_values)
