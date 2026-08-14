import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-small-result-keeps-everything-that-fits", "a modest result is left whole"),
    ("an-oversized-optional-field-is-dropped", "a huge optional payload does not travel"),
    ("optional-fields-are-kept-in-priority-order", "the spec order is the priority order"),
    ("a-lower-priority-field-is-dropped-before-a-higher-one", "the cheapest useful fields survive"),
    ("a-tight-budget-still-keeps-both-essentials", "essentials outrank every optional field"),
    (
        "essentials-over-budget-do-not-fit-and-are-not-truncated",
        "an over-budget result is reported",
    ),
    ("a-field-not-in-the-spec-is-dropped", "upstream fields do not leak into context"),
    ("a-missing-optional-field-is-simply-absent", "an absent field is not an error"),
    ("an-empty-result-fits-trivially", "nothing returned costs nothing"),
)


class ResultDesign(unittest.TestCase):
    def setUp(self):
        self.shape = load_impl(__file__).shape

    def run_case(self, entry: dict) -> dict:
        return self.shape(entry["present"], FIXTURE["spec"], entry["budget"])

    def essentials(self, entry: dict) -> list:
        return [
            f for f in FIXTURE["spec"] if f["essential"] and f["name"] in entry["present"]
        ]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_present_essential_field_is_kept(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)["kept"]
                for field in self.essentials(entry):
                    self.assertIn(field["name"], kept)

    def test_every_present_field_is_kept_or_dropped_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["kept"] + result["dropped"]), sorted(entry["present"])
                )

    def test_nothing_outside_the_spec_is_ever_kept(self):
        known = {field["name"] for field in FIXTURE["spec"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for name in self.run_case(entry)["kept"]:
                    self.assertIn(name, known)

    def test_tokens_is_the_cost_of_what_was_kept(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                cost = sum(
                    f["tokens"] for f in FIXTURE["spec"] if f["name"] in result["kept"]
                )
                self.assertEqual(result["tokens"], cost)

    def test_fits_is_false_exactly_when_essentials_are_over_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                cost = sum(f["tokens"] for f in self.essentials(entry))
                self.assertEqual(self.run_case(entry)["fits"], cost <= entry["budget"])

    def test_a_bigger_budget_never_keeps_less(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                generous = self.shape(
                    entry["present"], FIXTURE["spec"], entry["budget"] + 1000
                )
                self.assertGreaterEqual(
                    len(generous["kept"]), len(self.run_case(entry)["kept"])
                )
