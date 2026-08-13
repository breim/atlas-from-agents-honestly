import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-small-request-leaves-headroom", "an ordinary request has room to spare"),
    ("the-output-reservation-counts-against-the-window", "input fitting is not the request fitting"),
    ("input-alone-fitting-is-not-fitting", "the window holds both halves"),
    ("exactly-filling-the-window-fits", "landing exactly on the window is allowed"),
    ("one-token-over-does-not-fit", "one token past the window is a rejection"),
    ("an-oversized-output-reservation-alone-can-break-it", "a tiny prompt can still be too big"),
    ("an-empty-request-still-reserves-its-output", "the reservation exists with no prompt at all"),
)


class ContextWindow(unittest.TestCase):
    def setUp(self):
        self.plan = load_impl(__file__).plan

    def run_case(self, entry: dict) -> dict:
        return self.plan(entry["sections"], entry["maxOutput"], FIXTURE["windowTokens"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_input_is_the_sum_of_the_sections(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                total = sum(section["tokens"] for section in entry["sections"])
                self.assertEqual(self.run_case(entry)["input"], total)

    def test_the_three_quantities_account_for_the_whole_window(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    result["input"] + result["reserved"] + result["headroom"],
                    FIXTURE["windowTokens"],
                )

    def test_fits_and_over_by_agree_with_headroom(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["fits"], result["headroom"] >= 0)
                self.assertEqual(result["overBy"], max(0, -result["headroom"]))

    def test_reserving_more_output_never_makes_a_request_fit(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["fits"]:
                continue
            with self.subTest(entry["id"]):
                greedy = self.plan(
                    entry["sections"], entry["maxOutput"] + 1, FIXTURE["windowTokens"]
                )
                self.assertLess(greedy["headroom"], self.run_case(entry)["headroom"])
