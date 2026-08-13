import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-granted-read-under-a-clean-context-is-allowed", "the ordinary path works"),
    ("a-granted-write-under-a-clean-context-is-allowed", "a clean context can still act"),
    ("a-read-is-allowed-even-under-a-tainted-context", "taint does not make the agent useless"),
    ("a-write-under-a-tainted-context-is-denied", "hostile evidence cannot reach an effect"),
    ("a-write-under-a-reviewed-context-is-allowed", "reviewed is not tainted"),
    ("an-ungranted-tool-is-denied-even-under-a-clean-context", "a clean context is not a grant"),
    ("an-ungranted-tool-is-denied-for-the-grant-not-the-taint", "the reason names the first gate"),
    ("an-unknown-tool-is-denied", "a tool that does not exist is refused, not raised"),
)


class ToolPermissionBoundary(unittest.TestCase):
    def setUp(self):
        self.check = load_impl(__file__).check

    def run_case(self, entry: dict) -> dict:
        return self.check(entry["tool"], entry["trust"], FIXTURE["grants"], FIXTURE["tools"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["verdict"])

    def test_nothing_outside_the_grant_is_ever_allowed(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertIn(entry["tool"], FIXTURE["grants"])

    def test_no_write_is_ever_allowed_from_a_tainted_context(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                is_write = FIXTURE["tools"].get(entry["tool"]) == "write"
                self.assertFalse(is_write and entry["trust"] == "external")

    def test_allowed_carries_no_reason_and_denial_always_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verdict = self.run_case(entry)
                if verdict["allowed"]:
                    self.assertIsNone(verdict["reason"])
                else:
                    self.assertTrue(verdict["reason"])

    def test_every_combination_is_decidable_without_raising(self):
        for tool in [*FIXTURE["tools"], "nonexistent"]:
            for trust in ("system", "reviewed", "external", "unknown"):
                with self.subTest(tool=tool, trust=trust):
                    self.check(tool, trust, FIXTURE["grants"], FIXTURE["tools"])
