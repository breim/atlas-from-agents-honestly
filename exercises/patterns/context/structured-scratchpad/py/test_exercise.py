import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("empty-pad", "an empty pad renders as an empty string, not a stray newline"),
    ("single-write", "one write renders one line"),
    ("keys-render-in-first-write-order", "distinct keys keep the order they were first written"),
    ("last-write-wins", "writing a key twice leaves one line"),
    ("overwrite-keeps-its-position", "revising a key edits its line in place"),
    ("repeated-write-of-the-same-value", "rewriting the same value changes nothing"),
)


class StructuredScratchpad(unittest.TestCase):
    def setUp(self):
        self.render = load_impl(__file__).render

    def lines(self, writes: list) -> list:
        rendered = self.render(writes)
        return rendered.split("\n") if rendered else []

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.render(entry["writes"]), entry["rendered"])

    def test_one_line_per_distinct_key(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                keys = {write["key"] for write in entry["writes"]}
                self.assertEqual(len(self.lines(entry["writes"])), len(keys))

    def test_a_revision_never_moves_an_earlier_key(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                order = [line.split("=")[0] for line in self.lines(entry["writes"])]
                first_writes = list(dict.fromkeys(write["key"] for write in entry["writes"]))
                self.assertEqual(order, first_writes)
