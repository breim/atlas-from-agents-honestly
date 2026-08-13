import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-unresolved-timer-fires-at-its-deadline", "an untouched timer breaches on time"),
    ("resolving-before-the-deadline-cancels-the-timer", "resolving in time cancels the breach"),
    ("extending-moves-the-deadline", "an extension pushes the breach out"),
    ("an-extension-after-the-timer-fired-is-ignored", "a late extension cannot un-fire a breach"),
    ("resolving-after-the-timer-fired-does-not-unfire-it", "a late resolution cannot either"),
    ("the-last-extension-before-the-deadline-wins", "extensions compose in time order"),
    ("an-extension-can-shorten-the-deadline", "extend is the name, not the constraint"),
    ("a-deadline-beyond-the-horizon-has-not-fired-yet", "not yet fired is not cancelled"),
)


class SlaTimer(unittest.TestCase):
    def setUp(self):
        self.run_timer = load_impl(__file__).run_timer

    def run_case(self, entry: dict) -> dict:
        return self.run_timer(entry["deadline"], entry["events"], entry["horizon"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_firing_reports_a_time_and_not_firing_reports_none(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["fired"]:
                    self.assertIsInstance(result["at"], int)
                else:
                    self.assertIsNone(result["at"])

    def test_the_fire_time_is_a_deadline_the_timer_held(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["fired"]:
                continue
            with self.subTest(entry["id"]):
                held = {entry["deadline"], *(e.get("to") for e in entry["events"])}
                self.assertIn(result["at"], held)

    def test_nothing_after_the_fire_time_changes_the_outcome(self):
        for entry in FIXTURE["cases"]:
            outcome = self.run_case(entry)
            if not outcome["fired"]:
                continue
            with self.subTest(entry["id"]):
                before = [e for e in entry["events"] if e["at"] < outcome["at"]]
                self.assertEqual(
                    self.run_timer(entry["deadline"], before, entry["horizon"]), outcome
                )
