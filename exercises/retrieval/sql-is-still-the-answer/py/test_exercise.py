import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
LAYER = FIXTURE["layer"]
RAILS = FIXTURE["rails"]
PRINCIPALS = list(FIXTURE["principals"].values())

CASES = (
    (
        "a-governed-query-names-the-time-column-the-model-never-picked",
        "shipped_at, not created_at",
    ),
    (
        "the-same-question-compiles-the-same-way-for-every-asker",
        "metric drift, made impossible",
    ),
    (
        "a-different-metric-brings-its-own-time-column",
        "the definition decides, not the model",
    ),
    (
        "two-dimensions-group-in-the-order-they-were-asked-for",
        "the model picks from what you certified",
    ),
    (
        "a-row-limit-is-enforced-server-side-not-requested-politely",
        "a rail, not a request",
    ),
    ("an-unknown-metric-is-a-refusal-not-a-guess", "the failure mode you want"),
    ("an-unknown-dimension-is-a-refusal", "no invented column"),
    ("an-unknown-period-is-a-refusal", "no invented date range"),
    ("tenancy-is-decided-by-the-compiler-not-the-model", "the same rule as retrieval"),
    ("raw-sql-from-the-model-is-never-executed", "shape two, not shape three"),
    ("every-refusal-is-reported-not-just-the-first", "a full answer about why not"),
)


class SqlIsStillTheAnswer(unittest.TestCase):
    def setUp(self):
        self.compile_query = load_impl(__file__).compile_query

    def go(self, entry: dict, request: dict = None, principal: dict = None) -> dict:
        return self.compile_query(
            entry["request"] if request is None else request,
            LAYER,
            RAILS,
            principal or FIXTURE["principals"][entry["principal"]],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_refusal_never_carries_a_query(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                if outcome["status"] == "refused":
                    self.assertIsNone(outcome["sql"])
                    self.assertEqual(outcome["params"], [])
                    self.assertTrue(outcome["refusals"])
                else:
                    self.assertEqual(outcome["refusals"], [])
                    self.assertTrue(outcome["sql"])

    def test_anything_the_layer_does_not_define_is_refused(self):
        entry = case(
            FIXTURE, "a-governed-query-names-the-time-column-the-model-never-picked"
        )
        probes = {
            "metric": {**entry["request"], "metric": "gross_margin"},
            "dimension": {**entry["request"], "dimensions": ["warehouse"]},
            "period": {**entry["request"], "period": "last_quarter"},
        }
        for what, request in probes.items():
            with self.subTest(what):
                outcome = self.go(entry, request)
                self.assertEqual(outcome["status"], "refused")
                self.assertIsNone(outcome["sql"])

    def test_every_compiled_query_pins_the_tenant_to_the_principal(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    outcome = self.go(entry, None, principal)
                    self.assertEqual(
                        outcome["applied"]["tenantId"], principal["tenantId"]
                    )
                    if outcome["status"] != "compiled":
                        continue
                    self.assertIn("WHERE tenant_id = $1 AND", outcome["sql"])
                    self.assertEqual(outcome["params"][0], principal["tenantId"])

    def test_the_model_cannot_move_the_tenant_by_asking(self):
        entry = case(
            FIXTURE, "a-governed-query-names-the-time-column-the-model-never-picked"
        )
        for name in RAILS["reservedFilters"]:
            with self.subTest(name):
                outcome = self.go(
                    entry, {**entry["request"], "filters": {name: "northwind"}}
                )
                self.assertEqual(outcome["status"], "refused")
                self.assertTrue(any(name in reason for reason in outcome["refusals"]))

    def test_the_same_request_compiles_identically_for_every_asker(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                compiled = [self.go(entry, None, p) for p in PRINCIPALS]
                self.assertEqual(len({o["sql"] for o in compiled}), 1)
                self.assertEqual(len({o["status"] for o in compiled}), 1)
                for outcome in compiled:
                    self.assertEqual(outcome["params"][1:], compiled[0]["params"][1:])

    def test_the_time_column_comes_from_the_metric_definition(self):
        entry = case(
            FIXTURE, "a-governed-query-names-the-time-column-the-model-never-picked"
        )
        for name, metric in LAYER["metrics"].items():
            with self.subTest(name):
                outcome = self.go(entry, {**entry["request"], "metric": name})
                self.assertEqual(outcome["status"], "compiled")
                sql = outcome["sql"]
                self.assertIn(f"{metric['timeColumn']} >= $2", sql)
                self.assertIn(f"{metric['timeColumn']} < $3", sql)
                for other in LAYER["metrics"].values():
                    if other["timeColumn"] == metric["timeColumn"]:
                        continue
                    self.assertNotIn(other["timeColumn"], sql)

    def test_the_metric_carries_its_own_filters(self):
        entry = case(
            FIXTURE, "a-governed-query-names-the-time-column-the-model-never-picked"
        )
        for name, metric in LAYER["metrics"].items():
            with self.subTest(name):
                sql = self.go(entry, {**entry["request"], "metric": name})["sql"]
                for condition in metric["filters"]:
                    self.assertIn(condition, sql)

    def test_the_row_limit_is_always_applied_and_never_exceeds_the_rail(self):
        entry = case(
            FIXTURE, "a-governed-query-names-the-time-column-the-model-never-picked"
        )
        for limit in (1, 10, RAILS["maxRowLimit"], RAILS["maxRowLimit"] + 1, 5000000):
            with self.subTest(limit):
                outcome = self.go(entry, {**entry["request"], "limit": limit})
                owed = min(limit, RAILS["maxRowLimit"])
                self.assertEqual(outcome["applied"]["rowLimit"], owed)
                self.assertTrue(outcome["sql"].endswith(f" LIMIT {owed}"))
        unasked = self.go(entry, {k: v for k, v in entry["request"].items() if k != "limit"})
        self.assertEqual(unasked["applied"]["rowLimit"], RAILS["maxRowLimit"])

    def test_the_rails_hold_whatever_was_asked_for(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["applied"]["timeoutMs"], RAILS["timeoutMs"])
                self.assertEqual(outcome["applied"]["readOnly"], RAILS["readOnly"])
                self.assertLessEqual(
                    outcome["applied"]["rowLimit"], RAILS["maxRowLimit"]
                )

    def test_a_compiled_query_only_names_sql_the_layer_defined(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "compiled":
                continue
            with self.subTest(entry["id"]):
                metric = LAYER["metrics"][entry["request"]["metric"]]
                self.assertIn(f"FROM {metric['from']} ", outcome["sql"])
                for name in entry["request"]["dimensions"]:
                    self.assertIn(
                        f"{LAYER['dimensions'][name]['sql']} AS {name}", outcome["sql"]
                    )

    def test_grouping_follows_the_dimensions(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "compiled":
                continue
            with self.subTest(entry["id"]):
                dimensions = entry["request"]["dimensions"]
                if not dimensions:
                    self.assertNotIn("GROUP BY", outcome["sql"])
                else:
                    positions = ", ".join(str(i + 1) for i in range(len(dimensions)))
                    self.assertIn(
                        f"GROUP BY {positions} ORDER BY {positions}", outcome["sql"]
                    )
