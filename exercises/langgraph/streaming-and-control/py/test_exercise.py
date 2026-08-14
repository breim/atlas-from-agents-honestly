import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-clean-text-stream-assembles", "text chunks concatenate in order"),
    ("a-tool-call-assembles-from-its-fragments", "arguments arrive in pieces"),
    ("text-and-tool-calls-interleave", "text around a call is still one answer"),
    ("a-stream-cut-short-is-incomplete", "a fragment is not a final answer"),
    ("an-unclosed-tool-call-is-never-emitted", "truncated arguments never reach a dispatcher"),
    ("a-closed-call-survives-a-later-truncation", "what closed is real"),
    ("two-tool-calls-keep-their-order", "calls come back in stream order"),
    ("an-empty-stream-is-incomplete", "nothing received is not a clean finish"),
)

HOSTILE = (
    [{"type": "tool_arg", "value": "orphan"}],
    [{"type": "tool_end"}],
    [{"type": "tool_end"}, {"type": "tool_end"}],
    [{"type": "text"}],
)


class StreamingAndControl(unittest.TestCase):
    def setUp(self):
        self.assemble = load_impl(__file__).assemble

    def run_case(self, entry: dict) -> dict:
        return self.assemble(entry["chunks"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_complete_is_true_only_when_the_stream_said_so(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                said = any(chunk["type"] == "done" for chunk in entry["chunks"])
                self.assertEqual(self.run_case(entry)["complete"], said)

    def test_every_emitted_call_was_closed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                closed = sum(1 for c in entry["chunks"] if c["type"] == "tool_end")
                self.assertEqual(len(self.run_case(entry)["toolCalls"]), closed)

    def test_every_emitted_call_names_a_tool_the_stream_opened(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                opened = [
                    c.get("value") for c in entry["chunks"] if c["type"] == "tool_start"
                ]
                for call in self.run_case(entry)["toolCalls"]:
                    self.assertIn(call["name"], opened)

    def test_truncating_a_stream_never_adds_text_or_calls(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                full = self.run_case(entry)
                for cut in range(len(entry["chunks"])):
                    partial = self.assemble(entry["chunks"][:cut])
                    self.assertTrue(full["text"].startswith(partial["text"]))
                    self.assertLessEqual(
                        len(partial["toolCalls"]), len(full["toolCalls"])
                    )

    def test_nothing_raises_on_a_malformed_stream(self):
        for chunks in HOSTILE:
            with self.subTest(repr(chunks)):
                self.assemble(chunks)
