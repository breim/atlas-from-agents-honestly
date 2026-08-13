import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-single-keyword-routes", "a keyword picks its handler"),
    ("matching-is-case-insensitive", "capitalisation does not change the route"),
    ("the-first-declared-route-wins", "declaration order decides, not match count"),
    ("matching-is-on-whole-words", "creditor is not credit"),
    ("no-match-falls-back", "an unrecognised request goes to a person"),
    ("an-empty-request-falls-back", "an empty request is not a match"),
    ("punctuation-does-not-block-a-match", "a question mark is not part of the word"),
)


class Router(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_case(self, entry: dict) -> str:
        return self.route(entry["request"], FIXTURE["routes"], FIXTURE["fallback"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["route"])

    def test_every_request_routes_somewhere(self):
        names = {r["name"] for r in FIXTURE["routes"]} | {FIXTURE["fallback"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertIn(self.run_case(entry), names)

    def test_routing_is_a_pure_function_of_the_request(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry), self.run_case(entry))
