import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("two-distinct-approvers-authorise-the-action", "two people is two people"),
    ("one-approval-is-not-enough", "one signature does not clear a two-person gate"),
    ("the-same-person-twice-is-not-two-people", "distinct identities, not events"),
    ("the-requester-cannot-approve-their-own-request", "dual control excludes the requester"),
    ("an-approval-for-a-different-action-does-not-count", "signatures bind to an exact action"),
    ("extra-approvals-do-not-hurt", "more than enough is still enough"),
    ("no-approvals-authorise-nothing", "nothing signed is nothing authorised"),
)


class DualControl(unittest.TestCase):
    def setUp(self):
        self.authorise = load_impl(__file__).authorise

    def run_case(self, entry: dict) -> dict:
        return self.authorise(FIXTURE["request"], entry["approvals"], FIXTURE["required"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["verdict"])

    def test_the_requester_never_appears_among_the_approvers(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertNotIn(FIXTURE["request"]["by"], self.run_case(entry)["approvers"])

    def test_approvers_are_distinct(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                approvers = self.run_case(entry)["approvers"]
                self.assertEqual(len(set(approvers)), len(approvers))

    def test_every_approver_signed_this_exact_action(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for approver in self.run_case(entry)["approvers"]:
                    self.assertTrue(
                        any(
                            a["by"] == approver and a["action"] == FIXTURE["request"]["action"]
                            for a in entry["approvals"]
                        )
                    )

    def test_authorisation_happens_exactly_when_enough_signed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verdict = self.run_case(entry)
                self.assertEqual(
                    verdict["authorised"], len(verdict["approvers"]) >= FIXTURE["required"]
                )
                self.assertEqual(verdict["reason"] is None, verdict["authorised"])
