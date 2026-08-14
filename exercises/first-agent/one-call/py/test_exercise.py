import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ROUTES = FIXTURE["routes"]

CASES = (
    ("a-perfect-classifier-resolves-nothing", "excellent at its job, and a hard ceiling"),
    (
        "a-ticket-answerable-from-its-own-text-is-resolved",
        "the one shape a single call can close",
    ),
    (
        "a-wrong-category-is-not-resolved-even-when-answerable",
        "answerable is not the only condition",
    ),
    ("an-oblique-order-reference-costs-an-entity-not-a-category", "two of the twenty"),
    (
        "the-right-number-of-entities-is-not-the-right-entities",
        "a count is not a match",
    ),
    (
        "two-categories-that-share-a-queue-still-route-correctly",
        "the label and the destination differ",
    ),
    ("a-self-report-that-disagrees-with-reality", "a signal, not a guarantee"),
    ("an-empty-inbox-scores-nothing", "no tickets, no ceiling"),
)


class OneCall(unittest.TestCase):
    def setUp(self):
        self.triage = load_impl(__file__).triage

    @staticmethod
    def routes_of(entry: dict) -> dict:
        return entry.get("routes", ROUTES)

    def run_case(self, entry: dict, tickets: list = None, routes: dict = None) -> dict:
        return self.triage(
            entry["tickets"] if tickets is None else tickets,
            routes or self.routes_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_one_routing_per_ticket_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                routed = self.run_case(entry)["routed"]
                self.assertEqual(
                    [r["id"] for r in routed], [t["id"] for t in entry["tickets"]]
                )

    def test_every_ticket_goes_where_the_table_says(self):
        for entry in FIXTURE["cases"]:
            routes = self.routes_of(entry)
            routed = self.run_case(entry)["routed"]
            for index, item in enumerate(routed):
                with self.subTest(f"{entry['id']}:{item['id']}"):
                    self.assertEqual(
                        item["queue"],
                        routes[entry["tickets"][index]["predicted"]["category"]],
                    )

    def test_every_count_sits_between_nothing_and_everything(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                board = self.run_case(entry)["scoreboard"]
                self.assertEqual(board["total"], len(entry["tickets"]))
                for name, value in board.items():
                    self.assertGreaterEqual(value, 0, name)
                    self.assertLessEqual(value, board["total"], name)

    def test_nothing_is_resolved_that_was_not_answerable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                answerable = sum(
                    1 for t in entry["tickets"] if t["truth"]["answerable"]
                )
                self.assertLessEqual(
                    self.run_case(entry)["scoreboard"]["resolved"], answerable
                )

    def test_a_perfect_classifier_still_resolves_nothing_unanswerable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                perfect = [
                    {**t, "predicted": dict(t["truth"])} for t in entry["tickets"]
                ]
                board = self.run_case(entry, perfect)["scoreboard"]
                self.assertEqual(board["categoryCorrect"], board["total"])
                grounded = [
                    {
                        **t,
                        "predicted": {**t["predicted"], "answerable": False},
                        "truth": {**t["truth"], "answerable": False},
                    }
                    for t in perfect
                ]
                self.assertEqual(
                    self.run_case(entry, grounded)["scoreboard"]["resolved"], 0
                )

    def test_resolving_requires_the_category_too(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                board = self.run_case(entry)["scoreboard"]
                self.assertLessEqual(board["resolved"], board["categoryCorrect"])

    def test_a_correct_category_always_routes_correctly(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                board = self.run_case(entry)["scoreboard"]
                self.assertGreaterEqual(
                    board["routedCorrectly"], board["categoryCorrect"]
                )

    def test_the_self_report_decides_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                flipped = [
                    {
                        **t,
                        "predicted": {
                            **t["predicted"],
                            "answerable": not t["predicted"]["answerable"],
                        },
                    }
                    for t in entry["tickets"]
                ]
                after = self.run_case(entry, flipped)
                self.assertEqual(after["routed"], before["routed"])
                for key in before["scoreboard"]:
                    if key == "selfReportAgreed":
                        continue
                    self.assertEqual(
                        after["scoreboard"][key], before["scoreboard"][key], key
                    )

    def test_entity_extraction_is_scored_exactly(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owed = sum(
                    1
                    for t in entry["tickets"]
                    if t["predicted"]["orderIds"] == t["truth"]["orderIds"]
                    and t["predicted"]["partNumbers"] == t["truth"]["partNumbers"]
                )
                self.assertEqual(
                    self.run_case(entry)["scoreboard"]["entitiesCorrect"], owed
                )
