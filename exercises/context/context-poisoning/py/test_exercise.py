import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-fact-from-trusted-sources-is-admitted", "well-sourced facts become memory"),
    ("a-fact-derived-from-an-external-source-is-refused", "retrieved text does not become belief"),
    ("one-external-source-among-many-is-still-a-refusal", "there is no scoring, only every"),
    ("a-fact-contradicting-a-pinned-value-is-refused", "pinned values are pinned"),
    ("restating-a-pinned-value-is-admitted", "agreement is not contradiction"),
    ("an-untrusted-source-is-reported-before-a-contradiction", "the reason names the first gate"),
    ("a-fact-with-no-sources-is-refused", "unattributed is untrusted"),
    ("an-unrecognised-source-marking-is-untrusted", "an unnameable marking fails closed"),
)


class ContextPoisoning(unittest.TestCase):
    def setUp(self):
        self.admit = load_impl(__file__).admit

    def run_case(self, entry: dict) -> dict:
        return self.admit(entry["candidate"], FIXTURE["pinned"], FIXTURE["trusted"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_nothing_with_an_untrusted_source_is_admitted(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["admitted"]:
                continue
            with self.subTest(entry["id"]):
                for source in entry["candidate"]["sources"]:
                    self.assertIn(source, FIXTURE["trusted"])

    def test_nothing_contradicting_a_pinned_value_is_admitted(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["admitted"]:
                continue
            pin = FIXTURE["pinned"].get(entry["candidate"]["key"])
            if pin is None:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(pin, entry["candidate"]["value"])

    def test_adding_an_untrusted_source_always_flips_an_admission(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["admitted"]:
                continue
            with self.subTest(entry["id"]):
                tainted = {
                    **entry["candidate"],
                    "sources": [*entry["candidate"]["sources"], "external"],
                }
                self.assertEqual(
                    self.admit(tainted, FIXTURE["pinned"], FIXTURE["trusted"]),
                    {"admitted": False, "reason": "untrusted_source"},
                )

    def test_an_admission_carries_no_reason_and_a_refusal_always_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if result["admitted"]:
                    self.assertIsNone(result["reason"])
                else:
                    self.assertTrue(result["reason"])
