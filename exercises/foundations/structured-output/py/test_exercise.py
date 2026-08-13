import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("clean-json-parses", "a well-formed object parses"),
    ("json-wrapped-in-prose-is-extracted", "chattiness around the JSON is survivable"),
    ("json-in-a-fenced-block-is-extracted", "so is a code fence"),
    ("a-missing-required-field-is-rejected", "an absent field is an error"),
    ("a-wrong-type-is-rejected-not-coerced", "a numeric string is not a number"),
    ("a-boolean-as-a-string-is-still-the-wrong-type", 'nor is "true" a boolean'),
    ("an-unknown-field-is-rejected", "the model cannot add fields"),
    ("malformed-json-is-rejected", "broken JSON is not repaired"),
    ("no-json-at-all-is-rejected", "a refusal is not an object"),
    ("a-missing-field-is-reported-before-an-unknown-one", "the error order is fixed"),
)

HOSTILE = ("", "{", "}", "{{}}", "null", "[]", '{"a":', "}{")

PYTHON_TYPES = {"string": str, "number": (int, float), "boolean": bool}


class StructuredOutput(unittest.TestCase):
    def setUp(self):
        self.parse = load_impl(__file__).parse

    def run_case(self, entry: dict) -> dict:
        return self.parse(entry["text"], FIXTURE["schema"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_successful_parse_holds_exactly_the_schema_fields(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(
                    sorted(result["value"]), sorted(f["name"] for f in FIXTURE["schema"])
                )

    def test_every_parsed_field_has_its_declared_type(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["ok"]:
                continue
            with self.subTest(entry["id"]):
                for field in FIXTURE["schema"]:
                    value = result["value"][field["name"]]
                    if field["type"] == "number":
                        self.assertNotIsInstance(value, bool)
                    self.assertIsInstance(value, PYTHON_TYPES[field["type"]])

    def test_nothing_ever_raises(self):
        for text in HOSTILE:
            with self.subTest(repr(text)):
                self.parse(text, FIXTURE["schema"])

    def test_a_rejection_always_names_what_was_wrong(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertTrue(result["error"])
