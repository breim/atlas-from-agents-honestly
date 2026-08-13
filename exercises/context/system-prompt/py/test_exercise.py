import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("blocks-render-in-spec-order-not-input-order", "the spec decides the order"),
    ("a-missing-optional-block-is-simply-absent", "an optional block is optional"),
    ("a-missing-required-block-is-reported", "a missing policy is reported, not raised"),
    ("an-unknown-block-is-ignored-not-appended", "an unrecognised block cannot inject"),
    ("a-duplicate-block-keeps-the-first", "a later block cannot overrule an earlier one"),
    ("every-optional-block-present-renders-in-full", "a complete prompt renders in spec order"),
    (
        "no-blocks-yields-an-empty-prompt-and-reports-what-is-missing",
        "nothing supplied is still a report",
    ),
)


class SystemPrompt(unittest.TestCase):
    def setUp(self):
        self.assemble = load_impl(__file__).assemble

    def run_case(self, entry: dict) -> dict:
        return self.assemble(entry["blocks"], FIXTURE["spec"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_shuffling_the_input_never_changes_the_prompt(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shuffled = list(reversed(entry["blocks"]))
                self.assertEqual(
                    self.assemble(shuffled, FIXTURE["spec"])["prompt"],
                    self.run_case(entry)["prompt"],
                )

    def test_no_ignored_block_fully_reaches_the_prompt(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for name in result["ignored"]:
                    dropped = [b for b in entry["blocks"] if b["name"] == name]
                    rendered = [b for b in dropped if b["text"] in result["prompt"]]
                    self.assertLess(len(rendered), len(dropped))

    def test_the_prompt_is_built_only_from_spec_blocks(self):
        allowed = {entry["name"] for entry in FIXTURE["spec"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                prompt = self.run_case(entry)["prompt"]
                for block in entry["blocks"]:
                    if block["name"] in allowed:
                        continue
                    self.assertNotIn(block["text"], prompt)

    def test_every_required_block_is_rendered_or_reported(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for spec in [e for e in FIXTURE["spec"] if e["required"]]:
                    supplied = next(
                        (b for b in entry["blocks"] if b["name"] == spec["name"]), None
                    )
                    if spec["name"] in result["missing"]:
                        self.assertIsNone(supplied)
                    else:
                        self.assertIn(supplied["text"], result["prompt"])
