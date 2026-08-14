import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = FIXTURE["policy"]
CATALOGUE = FIXTURE["catalogue"]

CASES = (
    ("reads-run-together-and-writes-run-one-at-a-time", "different risk, different dispatch"),
    ("a-write-that-fails-stops-the-writes-behind-it", "a state no tool_result describes"),
    ("a-read-that-fails-does-not-stop-the-other-reads", "a wrong read costs a turn"),
    ("a-write-that-takes-a-filter-is-refused", "a filter is a program"),
    ("an-amount-over-the-ceiling-is-refused-by-the-handler", "maximum is prose, code is a bound"),
    ("only-a-pure-read-is-cacheable-and-freely-retriable", "the axis is who else has seen it"),
    (
        "a-catalogue-names-its-disguises-whether-or-not-anything-is-called",
        "read the handlers",
    ),
    (
        "a-tool-that-is-not-in-the-catalogue-is-refused-without-blocking-anything",
        "unknown is not a write",
    ),
)


def tool_of(name: str):
    return next((t for t in CATALOGUE if t["name"] == name), None)


class ReadAndWriteTools(unittest.TestCase):
    def setUp(self):
        self.dispatch = load_impl(__file__).dispatch

    def go(self, entry: dict, calls: list = None) -> dict:
        return self.dispatch(
            entry["calls"] if calls is None else calls, CATALOGUE, POLICY
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_read_is_attempted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for call in entry["calls"]:
                    tool = tool_of(call["name"])
                    rank = tool["class"] if tool else 0
                    if rank > 2:
                        continue
                    self.assertIn(call["id"], outcome["order"])
                    self.assertNotIn(call["id"], outcome["skipped"])

    def test_every_read_runs_before_every_write(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                ranks = {r["id"]: r["class"] for r in outcome["results"]}
                positions = [1 if ranks[i] >= 3 else 0 for i in outcome["order"]]
                self.assertEqual(positions, sorted(positions))

    def test_no_write_is_marked_parallel(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for outcome in self.go(entry)["results"]:
                    self.assertEqual(outcome["parallel"], 1 <= outcome["class"] <= 2)

    def test_after_a_write_fails_no_later_write_is_attempted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                failed = next(
                    (
                        r
                        for r in outcome["results"]
                        if r["status"] == "error" and r["class"] >= 3
                    ),
                    None,
                )
                writes = [
                    c
                    for c in entry["calls"]
                    if (tool_of(c["name"])["class"] if tool_of(c["name"]) else 0) >= 3
                ]
                if failed is None:
                    self.assertEqual(outcome["skipped"], [])
                    continue
                index = next(
                    i for i, c in enumerate(writes) if c["id"] == failed["id"]
                )
                after = [c["id"] for c in writes[index + 1 :]]
                self.assertEqual(outcome["skipped"], after)
                for call_id in after:
                    self.assertNotIn(call_id, outcome["order"])

    def test_a_failing_read_never_stops_anything(self):
        entry = case(FIXTURE, "a-read-that-fails-does-not-stop-the-other-reads")
        outcome = self.go(entry)
        self.assertTrue(any(r["status"] == "error" for r in outcome["results"]))
        self.assertEqual(outcome["skipped"], [])
        self.assertEqual(len(outcome["order"]), len(entry["calls"]))

    def test_every_call_is_attempted_or_skipped_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    sorted(outcome["order"] + outcome["skipped"]),
                    sorted(c["id"] for c in entry["calls"]),
                )
                self.assertEqual(
                    [r["id"] for r in outcome["results"]], outcome["order"]
                )

    def test_a_write_that_names_a_filter_is_always_refused(self):
        filtered = [
            t
            for t in CATALOGUE
            if t["class"] >= 3 and any(a["kind"] == "filter" for a in t["arguments"])
        ]
        self.assertTrue(filtered)
        entry = FIXTURE["cases"][0]
        for tool in filtered:
            with self.subTest(tool["name"]):
                outcome = self.go(
                    entry, [{"id": "probe", "name": tool["name"], "input": {}}]
                )
                self.assertEqual(outcome["results"][0]["status"], "error")
                self.assertIn("filter", outcome["results"][0]["reason"])

    def test_the_ceiling_is_enforced_at_the_boundary(self):
        entry = FIXTURE["cases"][0]
        bounded = next(t for t in CATALOGUE if "ceiling" in t)
        amount = next(a for a in bounded["arguments"] if a["kind"] == "amount")
        for value in (
            bounded["ceiling"] - 1,
            bounded["ceiling"],
            bounded["ceiling"] + 1,
        ):
            with self.subTest(value):
                payload = {amount["name"]: value}
                for other in bounded["arguments"]:
                    if other["kind"] == "identifier":
                        payload[other["name"]] = "x"
                outcome = self.go(
                    entry, [{"id": "probe", "name": bounded["name"], "input": payload}]
                )
                self.assertEqual(
                    outcome["results"][0]["status"] == "error",
                    value > bounded["ceiling"],
                )

    def test_only_a_pure_read_is_cacheable_and_retry_follows_the_class(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for outcome in self.go(entry)["results"]:
                    self.assertEqual(outcome["cacheable"], outcome["class"] == 1)
                    tool = tool_of(outcome["name"])
                    if outcome["class"] == 1:
                        owed = True
                    elif outcome["class"] <= 2:
                        owed = False
                    else:
                        owed = bool(tool and tool.get("idempotent"))
                    self.assertEqual(outcome["retriable"], owed)

    def test_the_audit_names_every_read_shaped_tool_that_is_not_a_pure_read(self):
        owed = [
            t["name"]
            for t in CATALOGUE
            if t["class"] >= 2
            and any(t["name"].startswith(p) for p in POLICY["readPrefixes"])
        ]
        self.assertTrue(owed)
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(self.go(entry)["mislabelled"], owed)

    def test_the_audit_is_a_property_of_the_catalogue(self):
        audits = {tuple(self.go(entry)["mislabelled"]) for entry in FIXTURE["cases"]}
        self.assertEqual(len(audits), 1)
