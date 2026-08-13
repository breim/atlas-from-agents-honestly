import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("fits", "a result inside the budget is returned untouched"),
    ("exactly-at-budget", "a result landing exactly on the budget is not elided"),
    ("elides-the-middle", "an oversized result keeps its head and its tail"),
    ("odd-budget-favours-the-head", "an odd remainder gives the extra character to the head"),
    ("budget-leaves-room-for-one-character", "a budget barely over the marker still keeps a head"),
    ("budget-below-the-marker", "a budget under the marker returns the marker, cut"),
)


class ToolResultTruncation(unittest.TestCase):
    def setUp(self):
        self.truncate = load_impl(__file__).truncate

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(
                    self.truncate(entry["text"], entry["budget"], FIXTURE["marker"]),
                    entry["output"],
                )

    def test_the_output_never_exceeds_the_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                actual = self.truncate(entry["text"], entry["budget"], FIXTURE["marker"])
                self.assertLessEqual(len(actual), entry["budget"])

    def test_an_elision_is_always_visible(self):
        marker = FIXTURE["marker"]
        for entry in FIXTURE["cases"]:
            if len(entry["text"]) <= entry["budget"]:
                continue
            with self.subTest(entry["id"]):
                actual = self.truncate(entry["text"], entry["budget"], marker)
                self.assertTrue(actual)
                self.assertTrue(marker.startswith(actual) or marker in actual)
