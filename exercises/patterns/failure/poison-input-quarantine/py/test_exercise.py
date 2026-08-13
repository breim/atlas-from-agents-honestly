import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-clean-queue-drains", "healthy items cost one attempt each"),
    ("a-poison-item-is-quarantined-after-the-threshold", "a hopeless item stops being retried"),
    ("a-poison-item-does-not-block-the-queue", "the item behind it still gets processed"),
    ("each-item-gets-its-own-attempt-budget", "one bad item does not spend another budget"),
    ("a-good-item-costs-a-single-attempt", "success does not consume the whole budget"),
    ("an-entirely-poisoned-queue-still-terminates", "a fully poisoned queue still finishes"),
    ("an-empty-queue-attempts-nothing", "nothing queued is nothing attempted"),
)


class Worker:
    """Counts real processing calls, so retrying a quarantined item is visible."""

    def __init__(self, poison: list):
        self.poison = poison
        self.calls = 0

    def __call__(self, item: str) -> bool:
        self.calls += 1
        return item not in self.poison


class PoisonInputQuarantine(unittest.TestCase):
    def setUp(self):
        self.drain = load_impl(__file__).drain

    def run_case(self, entry: dict):
        worker = Worker(entry["poison"])
        return self.drain(entry["queue"], worker, FIXTURE["threshold"]), worker.calls

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                outcome, _ = self.run_case(entry)
                self.assertEqual(outcome, entry["result"])

    def test_the_reported_attempt_count_is_real(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, calls = self.run_case(entry)
                self.assertEqual(outcome["attempts"], calls)

    def test_every_item_ends_up_processed_or_quarantined(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, _ = self.run_case(entry)
                self.assertEqual(
                    sorted(outcome["processed"] + outcome["quarantined"]), sorted(entry["queue"])
                )

    def test_no_item_is_attempted_more_than_the_threshold(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, _ = self.run_case(entry)
                self.assertLessEqual(
                    outcome["attempts"], len(entry["queue"]) * FIXTURE["threshold"]
                )

    def test_quarantine_holds_exactly_the_hopeless_items(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome, _ = self.run_case(entry)
                self.assertEqual(
                    sorted(outcome["quarantined"]),
                    sorted(i for i in entry["queue"] if i in entry["poison"]),
                )
