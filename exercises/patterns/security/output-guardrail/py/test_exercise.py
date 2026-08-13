import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("clean-output-passes-through", "nothing to catch means nothing changes"),
    ("a-redactable-secret-is-masked", "a redactable hit is replaced"),
    ("every-occurrence-is-redacted", "the second occurrence is not left behind"),
    ("a-credential-blocks-the-whole-response", "a leaked key is not a formatting problem"),
    ("blocking-wins-over-redacting", "a response tripping both rules is blocked"),
    (
        "a-blocked-response-releases-nothing-not-a-partial",
        "blocking does not release the surroundings",
    ),
    ("a-label-is-reported-once-however-many-times-it-hits", "hits are labels, not occurrences"),
    ("empty-output-is-clean", "an empty response is releasable"),
)


class OutputGuardrail(unittest.TestCase):
    def setUp(self):
        self.guard = load_impl(__file__).guard

    def run_case(self, entry: dict) -> dict:
        return self.guard(entry["text"], FIXTURE["rules"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_no_released_text_ever_contains_a_rule_pattern(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["released"]:
                continue
            with self.subTest(entry["id"]):
                for rule in FIXTURE["rules"]:
                    self.assertNotIn(rule["pattern"], result["text"])

    def test_a_blocked_response_releases_nothing(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["released"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["text"], "")

    def test_hits_are_exactly_the_rules_that_matched(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                matched = [
                    rule["label"] for rule in FIXTURE["rules"] if rule["pattern"] in entry["text"]
                ]
                self.assertEqual(self.run_case(entry)["hits"], matched)

    def test_any_text_containing_a_blocking_pattern_is_blocked(self):
        for rule in FIXTURE["rules"]:
            if rule["action"] != "block":
                continue
            for wrapper in ("{}", "before {}", "{} after", "a {} b"):
                text = wrapper.format(rule["pattern"])
                with self.subTest(text):
                    self.assertFalse(self.guard(text, FIXTURE["rules"])["released"])
