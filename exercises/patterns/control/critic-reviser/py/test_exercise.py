import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-clean-draft-is-accepted-unchanged", "nothing to revise means nothing changes"),
    ("a-revision-that-resolves-a-finding-is-accepted", "a genuine fix is taken"),
    ("a-revision-that-introduces-a-finding-is-rejected", "a regression is refused"),
    ("a-revision-that-resolves-nothing-is-rejected", "churn is not improvement"),
    ("a-rejected-revision-does-not-end-the-loop", "a bad round is not terminal"),
    ("a-later-revision-builds-on-the-accepted-one", "accepted revisions compound"),
    ("a-trade-off-revision-is-still-a-rejection", "two fixes do not buy one regression"),
)


class CriticReviser(unittest.TestCase):
    def setUp(self):
        self.revise = load_impl(__file__).revise

    def run_case(self, entry: dict) -> dict:
        return self.revise(entry["draft"], entry["rounds"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_returned_draft_is_original_or_accepted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.run_case(entry)
                self.assertIn(outcome["draft"], {entry["draft"], *outcome["accepted"]})

    def test_no_revision_that_introduced_a_finding_was_accepted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                accepted = self.run_case(entry)["accepted"]
                for round_ in entry["rounds"]:
                    if round_["introduces"]:
                        self.assertNotIn(round_["draft"], accepted)

    def test_every_round_is_judged_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.run_case(entry)
                self.assertEqual(
                    sorted(outcome["accepted"] + outcome["rejected"]),
                    sorted(round_["draft"] for round_ in entry["rounds"]),
                )
