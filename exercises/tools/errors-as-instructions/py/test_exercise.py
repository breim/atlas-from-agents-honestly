import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-known-error-becomes-an-instruction", "a catalogued failure tells the model what to do"),
    ("an-instruction-names-the-argument-to-change", "the next call can be a corrected one"),
    ("a-transient-failure-says-to-try-again", "a timeout is worth retrying"),
    ("an-unknown-code-does-not-invite-a-retry", "silence about the remedy means stop"),
    ("a-missing-code-is-treated-as-unknown", "an empty code is not a catalogue hit"),
)

OUTSIDE = ("", "nope", "kernel_panic_0x8f", "ORDER_NOT_FOUND")


class ErrorsAsInstructions(unittest.TestCase):
    def setUp(self):
        self.instruct = load_impl(__file__).instruct

    def run_case(self, entry: dict) -> dict:
        return self.instruct(entry["code"], FIXTURE["catalogue"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_result_carries_a_non_empty_message(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertTrue(self.run_case(entry)["message"])

    def test_nothing_outside_the_catalogue_is_ever_retryable(self):
        for code in OUTSIDE:
            if code in FIXTURE["catalogue"]:
                continue
            with self.subTest(code):
                self.assertFalse(self.instruct(code, FIXTURE["catalogue"])["retryable"])

    def test_a_catalogued_instruction_is_passed_through_verbatim(self):
        for code, entry in FIXTURE["catalogue"].items():
            with self.subTest(code):
                result = self.instruct(code, FIXTURE["catalogue"])
                self.assertEqual(result["message"], entry["instruction"])
                self.assertEqual(result["retryable"], entry["retryable"])
                self.assertEqual(result["fields"], entry["fields"])

    def test_an_empty_catalogue_makes_everything_unknown(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.instruct(entry["code"], {})
                self.assertFalse(result["retryable"])
                self.assertEqual(result["fields"], [])
