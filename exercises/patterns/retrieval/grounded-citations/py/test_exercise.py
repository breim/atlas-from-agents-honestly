import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-cited-claim-survives", "a properly cited claim is returned untouched"),
    ("an-uncited-claim-is-dropped", "a claim with no citation does not survive"),
    (
        "a-claim-citing-only-unknown-sources-is-dropped",
        "stripping citations must also drop the claim",
    ),
    ("unknown-citations-are-stripped-from-a-valid-claim", "an invented citation is removed"),
    ("duplicate-citations-collapse", "the same source is cited once"),
    ("citations-keep-the-order-they-were-given", "citation order is not sorted"),
    ("surviving-claims-keep-their-order", "dropping a claim does not reorder the rest"),
    ("nothing-in-nothing-out", "no claims is an empty list"),
)


class GroundedCitations(unittest.TestCase):
    def setUp(self):
        self.ground = load_impl(__file__).ground

    def run_case(self, entry: dict) -> list:
        return self.ground(entry["claims"], FIXTURE["sources"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["grounded"])

    def test_every_surviving_claim_carries_at_least_one_citation(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for claim in self.run_case(entry):
                    self.assertTrue(claim["cites"])

    def test_no_citation_names_a_source_that_was_never_retrieved(self):
        retrieved = set(FIXTURE["sources"])
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for claim in self.run_case(entry):
                    for cite in claim["cites"]:
                        self.assertIn(cite, retrieved)

    def test_claim_text_is_never_edited(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                original = {claim["text"] for claim in entry["claims"]}
                for claim in self.run_case(entry):
                    self.assertIn(claim["text"], original)
