import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-aggregation-goes-to-sql", "counting is a database question"),
    ("a-relationship-question-goes-to-the-graph", "hops are a graph question"),
    ("an-exact-identifier-goes-to-lexical-search", "an id is a lexical question"),
    ("a-question-about-right-now-goes-to-the-live-api", "current state is not in any index"),
    ("no-recognised-signal-falls-back-to-semantic", "the default is the least bad answer"),
    ("an-unrecognised-signal-also-falls-back", "an unknown signal is not a route"),
    ("freshness-outranks-aggregation", "a snapshot cannot answer a freshness question"),
    ("table-order-decides-not-signal-order", "detection order must not change the route"),
    ("every-signal-at-once-still-routes-to-one-store", "the router picks one store, always"),
)


class WhereDoesTheAnswerLive(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_case(self, entry: dict) -> str:
        return self.route(entry["signals"], FIXTURE["table"], FIXTURE["fallback"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["route"])

    def test_the_route_is_always_declared(self):
        stores = {rule["store"] for rule in FIXTURE["table"]} | {FIXTURE["fallback"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertIn(self.run_case(entry), stores)

    def test_signal_order_never_changes_the_route(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = self.route(
                    list(reversed(entry["signals"])), FIXTURE["table"], FIXTURE["fallback"]
                )
                self.assertEqual(flipped, self.run_case(entry))

    def test_the_winning_rule_is_the_highest_matching_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                chosen = self.run_case(entry)
                stores = [rule["store"] for rule in FIXTURE["table"]]
                if chosen not in stores:
                    continue
                index = stores.index(chosen)
                for earlier in FIXTURE["table"][:index]:
                    self.assertNotIn(earlier["signal"], entry["signals"])

    def test_adding_the_top_signal_always_wins(self):
        top = FIXTURE["table"][0]
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                route = self.route(
                    [*entry["signals"], top["signal"]], FIXTURE["table"], FIXTURE["fallback"]
                )
                self.assertEqual(route, top["store"])
