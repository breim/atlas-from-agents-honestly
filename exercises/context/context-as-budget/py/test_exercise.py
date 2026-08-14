import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
BUDGET = FIXTURE["budget"]

CASES = (
    (
        "everything-fits-and-most-of-the-window-stays-empty",
        "headroom is the plan, not a gap in it",
    ),
    (
        "a-larger-window-changes-only-the-headroom",
        "permission to send more is not a reason to",
    ),
    ("too-many-documents-are-reranked-down-not-given-more-room", "never just add room"),
    ("the-oldest-tool-results-go-first", "facts that already did their work"),
    ("history-is-compacted-oldest-first", "the late-run regime"),
    (
        "facts-are-evicted-before-turns-and-turns-before-documents",
        "the order, decided in advance",
    ),
    (
        "a-system-prompt-over-budget-fails-the-build-and-evicts-nothing",
        "fix the constant",
    ),
    (
        "too-many-tools-fails-the-build-before-anything-runs",
        "over budget means too many tools",
    ),
    ("the-output-reserve-is-never-lent-out", "a hard reserve"),
)


def raw_of(request: dict) -> dict:
    return {
        "system": request["system"],
        "schemas": request["schemas"],
        "documents": sum(d["tokens"] for d in request["documents"]),
        "results": sum(r["tokens"] for r in request["results"]),
        "history": sum(h["tokens"] for h in request["history"]),
        "user": request["user"],
    }


class ContextAsBudget(unittest.TestCase):
    def setUp(self):
        self.allocate = load_impl(__file__).allocate

    @staticmethod
    def budget_of(entry: dict) -> dict:
        return entry.get("budget", BUDGET)

    def go(self, entry: dict, budget: dict = None, request: dict = None) -> dict:
        return self.allocate(
            entry["request"] if request is None else request,
            budget or self.budget_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_no_claimant_is_over_its_allocation_once_the_build_succeeds(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] == "failed-build":
                continue
            with self.subTest(entry["id"]):
                for row in self.budget_of(entry)["rows"]:
                    self.assertLessEqual(
                        outcome["breakdown"][row["claimant"]], row["allocation"]
                    )

    def test_the_output_reserve_is_never_lent_out(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                budget = self.budget_of(entry)
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["headroom"],
                    budget["window"] - budget["reserveOutput"] - outcome["total"],
                )
                self.assertEqual(
                    outcome["total"] + budget["reserveOutput"] + outcome["headroom"],
                    budget["window"],
                )

    def test_a_larger_window_changes_the_headroom_and_nothing_else(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                budget = self.budget_of(entry)
                roomier = {**budget, "window": budget["window"] * 10}
                before = self.go(entry)
                after = self.go(entry, roomier)
                self.assertEqual(after["breakdown"], before["breakdown"])
                self.assertEqual(after["evicted"], before["evicted"])
                self.assertEqual(after["total"], before["total"])
                self.assertGreater(after["headroom"], before["headroom"])

    def test_a_failed_build_evicts_nothing(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "failed-build":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["evicted"], [])
                self.assertTrue(outcome["errors"])
                self.assertEqual(outcome["breakdown"], raw_of(entry["request"]))

    def test_a_constant_over_its_allocation_is_the_only_build_failure(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                budget = self.budget_of(entry)
                outcome = self.go(entry)
                over = [
                    claimant
                    for claimant in ("system", "schemas")
                    if entry["request"][claimant]
                    > next(
                        row["allocation"]
                        for row in budget["rows"]
                        if row["claimant"] == claimant
                    )
                ]
                self.assertEqual(outcome["status"] == "failed-build", bool(over))
                self.assertEqual(len(outcome["errors"]), len(over))

    def test_the_system_prompt_and_schemas_are_never_evicted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for eviction in outcome["evicted"]:
                    self.assertNotIn(eviction["claimant"], ("system", "schemas"))
                if outcome["status"] != "failed-build":
                    self.assertEqual(
                        outcome["breakdown"]["system"], entry["request"]["system"]
                    )
                    self.assertEqual(
                        outcome["breakdown"]["schemas"], entry["request"]["schemas"]
                    )

    def test_evictions_follow_the_declared_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                order = self.budget_of(entry)["evictionOrder"]
                seen = [
                    order.index(eviction["claimant"])
                    for eviction in self.go(entry)["evicted"]
                ]
                self.assertEqual(seen, sorted(seen))

    def test_within_a_claimant_the_oldest_and_lowest_ranked_go_first(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)

                def gone(claimant: str) -> list:
                    return [
                        e["id"]
                        for e in outcome["evicted"]
                        if e["claimant"] == claimant
                    ]

                dropped_results = gone("results")
                for dropped in entry["request"]["results"]:
                    if dropped["id"] not in dropped_results:
                        continue
                    for kept in entry["request"]["results"]:
                        if kept["id"] in dropped_results:
                            continue
                        self.assertLess(dropped["step"], kept["step"])

                dropped_docs = gone("documents")
                for dropped in entry["request"]["documents"]:
                    if dropped["id"] not in dropped_docs:
                        continue
                    for kept in entry["request"]["documents"]:
                        if kept["id"] in dropped_docs:
                            continue
                        self.assertGreater(dropped["rank"], kept["rank"])

    def test_the_total_is_the_breakdown_and_eviction_only_removes(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["total"], sum(outcome["breakdown"].values()))
                removed = sum(e["tokens"] for e in outcome["evicted"])
                self.assertEqual(
                    outcome["total"], sum(raw_of(entry["request"]).values()) - removed
                )

    def test_an_unbounded_claimant_cannot_grow_the_request_past_its_row(self):
        entry = case(FIXTURE, "everything-fits-and-most-of-the-window-stays-empty")
        flooded = {
            **entry["request"],
            "results": [{"id": "res-flood", "step": 9, "tokens": 400000}],
            "history": [
                {**turn, "tokens": 250000} for turn in entry["request"]["history"]
            ],
        }
        outcome = self.go(entry, None, flooded)
        self.assertLessEqual(outcome["breakdown"]["results"], 8000)
        self.assertLessEqual(outcome["breakdown"]["history"], 30000)
        self.assertEqual(outcome["status"], "trimmed")
