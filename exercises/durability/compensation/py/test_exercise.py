import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("every-step-succeeds-and-nothing-is-unwound", "the happy path leaves no trace"),
    ("a-failure-before-the-pivot-unwinds-in-reverse", "reverse order, only what ran"),
    ("a-failure-after-the-pivot-finishes-forward", "past the pivot, finish"),
    ("a-business-rejection-does-not-burn-the-retry-budget", "not transient, not retried"),
    (
        "a-compensation-that-fails-raises-an-incident-and-the-rest-still-run",
        "a human owns it by name",
    ),
    (
        "a-reversible-write-with-no-compensation-cannot-take-part",
        "checkable, not discovered",
    ),
    ("an-irreversible-step-before-the-pivot-is-a-design-error", "order by reversibility"),
    ("a-tool-that-is-not-in-the-catalogue-is-refused", "compensations attach to tools"),
)


class Compensation(unittest.TestCase):
    def setUp(self):
        self.run_saga = load_impl(__file__).run

    def go(self, entry, plan=None, world=None, config=None):
        return self.run_saga(
            entry["plan"] if plan is None else plan,
            entry["catalogue"],
            entry["world"] if world is None else world,
            config or entry["config"],
        )

    @staticmethod
    def tool_of(entry, name):
        return next(t for t in entry["catalogue"] if t["name"] == name)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_an_invalid_plan_runs_nothing(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "invalid":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["applied"], [])
                self.assertEqual(outcome["unwound"], [])
                self.assertTrue(outcome["errors"])

    def test_only_successful_steps_are_unwound_in_reverse(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "unwound":
                continue
            with self.subTest(entry["id"]):
                succeeded = [a["tool"] for a in outcome["applied"][:-1]]
                self.assertEqual(
                    [u["step"] for u in outcome["unwound"]], list(reversed(succeeded))
                )
                failed = outcome["applied"][-1]["tool"]
                self.assertFalse(any(u["step"] == failed for u in outcome["unwound"]))

    def test_nothing_after_the_failure_was_applied(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] in ("invalid", "completed"):
                continue
            with self.subTest(entry["id"]):
                index = next(
                    i for i, s in enumerate(entry["plan"]) if s["outcome"] != "ok"
                )
                self.assertEqual(len(outcome["applied"]), index + 1)

    def test_a_rejection_is_attempted_once_and_a_transient_to_the_cap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for item in outcome["applied"]:
                    step = next(
                        s for s in entry["plan"] if s["tool"] == item["tool"]
                    )
                    if step["outcome"] == "rejected":
                        self.assertEqual(item["attempts"], 1)
                    if step["outcome"] == "transient":
                        self.assertEqual(
                            item["attempts"], entry["config"]["maxAttempts"]
                        )
                    if step["outcome"] == "ok":
                        self.assertEqual(item["attempts"], 1)

    def test_a_failure_past_the_pivot_never_reverses(self):
        entry = case(FIXTURE, "a-failure-after-the-pivot-finishes-forward")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "forward-only")
        self.assertEqual(outcome["unwound"], [])
        self.assertEqual(outcome["incidents"], [])

    def test_the_pivot_decides_the_direction(self):
        entry = case(FIXTURE, "a-failure-before-the-pivot-unwinds-in-reverse")
        self.assertEqual(self.go(entry)["status"], "unwound")
        moved = self.go(entry, None, None, {**entry["config"], "pivot": "hold_funds"})
        self.assertEqual(moved["status"], "forward-only")

    def test_a_failed_compensation_is_an_incident_and_stops_nothing(self):
        entry = case(
            FIXTURE,
            "a-compensation-that-fails-raises-an-incident-and-the-rest-still-run",
        )
        outcome = self.go(entry)
        failed = [u for u in outcome["unwound"] if u["status"] == "failed"]
        self.assertTrue(failed)
        self.assertTrue(
            any(u["status"] == "compensated" for u in outcome["unwound"])
        )
        for item in failed:
            self.assertTrue(
                any(item["step"] in incident for incident in outcome["incidents"])
            )

    def test_every_compensation_named_is_the_declared_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for item in self.go(entry)["unwound"]:
                    tool = self.tool_of(entry, item["step"])
                    self.assertEqual(
                        item["compensation"], tool["compensation"] or ""
                    )
                    if not tool["compensation"]:
                        self.assertEqual(item["status"], "none")

    def test_a_reversible_write_with_no_compensation_is_refused(self):
        entry = case(FIXTURE, "every-step-succeeds-and-nothing-is-unwound")
        orphan = next(
            t
            for t in entry["catalogue"]
            if t["reversibility"] == "reversible" and not t["compensation"]
        )
        outcome = self.go(
            entry, [{"tool": orphan["name"], "outcome": "ok"}] + entry["plan"]
        )
        self.assertEqual(outcome["status"], "invalid")
        self.assertTrue(any(orphan["name"] in e for e in outcome["errors"]))

    def test_anything_not_reversible_before_the_pivot_is_a_design_error(self):
        entry = case(FIXTURE, "every-step-succeeds-and-nothing-is-unwound")
        for tool in entry["catalogue"]:
            if tool["reversibility"] == "reversible":
                continue
            if tool["name"] == entry["config"]["pivot"]:
                continue
            with self.subTest(tool["name"]):
                outcome = self.go(
                    entry,
                    [
                        {"tool": tool["name"], "outcome": "ok"},
                        {"tool": entry["config"]["pivot"], "outcome": "ok"},
                    ],
                )
                self.assertEqual(outcome["status"], "invalid")
                self.assertTrue(any(tool["name"] in e for e in outcome["errors"]))
