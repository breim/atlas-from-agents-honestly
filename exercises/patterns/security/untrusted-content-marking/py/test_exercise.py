import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-empty-context-is-fully-trusted", "nothing retrieved is nothing to distrust"),
    ("a-single-reviewed-source-caps-at-reviewed", "the ceiling follows the source"),
    ("one-external-source-drags-the-whole-context-down", "one untrusted passage caps everything"),
    ("position-does-not-matter", "where the untrusted chunk sits is irrelevant"),
    ("quantity-does-not-matter", "three trusted sources do not outvote one hostile one"),
    ("all-system-sources-stay-at-system", "a wholly trusted context stays trusted"),
    ("an-unknown-marking-is-treated-as-external", "unnamed provenance fails closed"),
)


class UntrustedContentMarking(unittest.TestCase):
    def setUp(self):
        self.ceiling = load_impl(__file__).ceiling

    def run_case(self, entry: dict) -> str:
        return self.ceiling(entry["sources"], FIXTURE["order"])

    def level(self, mark: str) -> int:
        return FIXTURE["order"].index(mark) if mark in FIXTURE["order"] else 0

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["ceiling"])

    def test_the_ceiling_is_always_a_declared_level(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertIn(self.run_case(entry), FIXTURE["order"])

    def test_the_ceiling_is_never_above_any_source(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.level(self.run_case(entry))
                for source in entry["sources"]:
                    self.assertLessEqual(result, self.level(source))

    def test_adding_a_source_can_only_lower_the_ceiling(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.level(self.run_case(entry))
                for added in FIXTURE["order"]:
                    after = self.level(self.ceiling([*entry["sources"], added], FIXTURE["order"]))
                    self.assertLessEqual(after, before)
