import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("one-effect-and-knowable-parameters-is-well-scoped", "a well-scoped tool passes"),
    ("two-effects-in-one-tool-is-too-coarse", "a mode switch is two tools"),
    ("a-required-parameter-the-model-cannot-know-is-a-design-error", "the model will invent it"),
    ("an-optional-unknowable-parameter-is-fine", "optional means the model can omit it"),
    ("too-many-parameters-is-flagged", "the ceiling is enforced"),
    ("every-issue-is-reported-in-order", "one review reports everything"),
    ("a-tool-with-no-parameters-is-fine", "a tool need not take arguments"),
    ("a-tool-with-no-effect-is-not-a-tool", "a tool that does nothing wastes a step"),
)


class SchemaAndGranularity(unittest.TestCase):
    def setUp(self):
        self.assess = load_impl(__file__).assess

    def run_case(self, entry: dict) -> dict:
        return self.assess(entry["tool"], FIXTURE["knownFields"], FIXTURE["maxParams"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_verdict_always_follows_the_issues(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    result["verdict"], "ok" if not result["issues"] else "revise"
                )

    def test_an_optional_parameter_is_never_flagged(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                issues = self.run_case(entry)["issues"]
                for param in entry["tool"]["params"]:
                    if not param["required"]:
                        self.assertNotIn(f"undeterminable_param:{param['name']}", issues)

    def test_making_every_parameter_knowable_removes_those_issues(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                generous = [
                    *FIXTURE["knownFields"],
                    *[p["name"] for p in entry["tool"]["params"]],
                ]
                issues = self.assess(entry["tool"], generous, FIXTURE["maxParams"])["issues"]
                self.assertFalse(
                    any(i.startswith("undeterminable_param") for i in issues)
                )

    def test_a_passing_tool_has_one_effect_and_knowable_requirements(self):
        for entry in FIXTURE["cases"]:
            if self.run_case(entry)["verdict"] != "ok":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(len(entry["tool"]["effects"]), 1)
                self.assertLessEqual(len(entry["tool"]["params"]), FIXTURE["maxParams"])
                for param in entry["tool"]["params"]:
                    if param["required"]:
                        self.assertIn(param["name"], FIXTURE["knownFields"])
