import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
WORLD = FIXTURE["world"]

CASES = (
    ("four-steps-and-an-answer", "the step the model chose for itself"),
    (
        "an-answer-on-the-first-step-needs-no-tool-at-all",
        "one call, no loop, still an outcome",
    ),
    ("the-model-declares-it-cannot-finish", "a deliberate, structured handoff"),
    ("a-terminal-tool-cancels-the-turn-it-was-in", "nothing else in that turn runs"),
    ("the-step-cap-halts-a-loop-that-will-not-converge", "a bound you own"),
    ("a-budget-is-checked-before-the-call-not-after", "a limit, not a report"),
    ("the-deadline-halts-a-run-that-is-merely-slow", "cheap and still too slow"),
    (
        "an-error-is-still-a-message-and-the-loop-continues",
        "a failure the model reads and recovers from",
    ),
    (
        "a-tool-refuses-data-that-belongs-to-another-customer",
        "the filter is a parameter, not a prompt",
    ),
    (
        "a-long-result-is-truncated-not-dropped",
        "a blunt cut, and the field that mattered",
    ),
)


class TheLoopByHand(unittest.TestCase):
    def setUp(self):
        self.run_loop = load_impl(__file__).run

    @staticmethod
    def config_of(entry: dict) -> dict:
        return entry.get("config", CONFIG)

    def go(self, entry: dict, config: dict = None, script: list = None) -> dict:
        return self.run_loop(
            entry["ticket"],
            entry["script"] if script is None else script,
            config or self.config_of(entry),
            WORLD,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_halted_run_never_carries_an_answer(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "halted":
                continue
            with self.subTest(entry["id"]):
                self.assertIsNone(outcome["reply"])
                self.assertIsNone(outcome["reason"])
                self.assertIsNotNone(outcome["bound"])

    def test_only_a_halt_names_a_bound(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertIn(outcome["status"], ("answered", "escalated", "halted"))
                if outcome["status"] == "answered":
                    self.assertIsInstance(outcome["reply"], str)
                    self.assertIsNone(outcome["bound"])
                if outcome["status"] == "escalated":
                    self.assertIsInstance(outcome["reason"], str)
                    self.assertIsNone(outcome["reply"])
                    self.assertIsNone(outcome["bound"])

    def test_no_step_is_started_once_a_bound_is_already_crossed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                config = self.config_of(entry)
                outcome = self.go(entry)
                cost = 0
                elapsed = 0
                for index in range(outcome["steps"]):
                    self.assertLessEqual(cost, config["maxCostCents"])
                    self.assertLessEqual(elapsed, config["deadlineMs"])
                    cost += entry["script"][index]["costCents"]
                    elapsed += entry["script"][index]["tookMs"]
                self.assertEqual(outcome["costCents"], cost)
                self.assertEqual(outcome["elapsedMs"], elapsed)

    def test_the_step_cap_is_never_exceeded(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertLessEqual(outcome["steps"], self.config_of(entry)["maxSteps"])
                self.assertEqual(len(outcome["trace"]), outcome["steps"])
                for index, step in enumerate(outcome["trace"]):
                    self.assertEqual(step["step"], index + 1)

    def test_the_history_grows_by_two_messages_per_tool_step(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for index, step in enumerate(outcome["trace"]):
                    self.assertEqual(step["messages"], index * 2 + 1)
                if outcome["trace"]:
                    self.assertGreater(
                        outcome["messages"], outcome["trace"][-1]["messages"]
                    )

    def test_a_terminal_tool_ends_the_turn_before_any_other_call_runs(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            for step in outcome["trace"]:
                if "escalate_to_human" not in step["calls"]:
                    continue
                with self.subTest(entry["id"]):
                    self.assertEqual(outcome["status"], "escalated")
                    self.assertEqual(step["results"], [])
                    self.assertEqual(step["step"], outcome["steps"])

    def test_every_tool_call_that_ran_produced_exactly_one_result(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for step in self.go(entry)["trace"]:
                    if not step["results"]:
                        continue
                    self.assertEqual(len(step["results"]), len(step["calls"]))
                    for result in step["results"]:
                        self.assertEqual(
                            result.get("isError", False),
                            result["content"].startswith("Error: "),
                        )

    def test_no_result_is_ever_longer_than_the_cap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                cap = self.config_of(entry)["maxResultChars"]
                for step in self.go(entry)["trace"]:
                    for result in step["results"]:
                        self.assertLessEqual(len(result["content"]), cap)

    def test_a_tool_never_returns_another_customer_data(self):
        entry = case(FIXTURE, "four-steps-and-an-answer")
        stranger = {**entry["ticket"], "customerId": "northwind"}
        outcome = self.run_loop(
            stranger, entry["script"], self.config_of(entry), WORLD
        )
        for step in outcome["trace"]:
            for result in step["results"]:
                if result.get("isError"):
                    continue
                self.assertTrue(
                    any(
                        record["customerId"] is None
                        and record["data"].startswith(result["content"])
                        for record in WORLD["records"].values()
                    ),
                    f"acme data reached northwind: {result['content']}",
                )

    def test_a_model_that_never_stops_is_stopped_by_the_cap(self):
        entry = case(FIXTURE, "the-step-cap-halts-a-loop-that-will-not-converge")
        insatiable = [entry["script"][0]] * 40
        outcome = self.go(entry, {**self.config_of(entry), "maxSteps": 5}, insatiable)
        self.assertEqual(outcome["status"], "halted")
        self.assertEqual(outcome["bound"], "steps")
        self.assertEqual(outcome["steps"], 5)
        self.assertIsNone(outcome["reply"])

    def test_an_unreachable_answer_is_never_reached(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "halted":
                continue
            with self.subTest(entry["id"]):
                self.assertLess(outcome["steps"], len(entry["script"]))
                unread = entry["script"][outcome["steps"] :]
                self.assertTrue(
                    any(response["stopReason"] == "end_turn" for response in unread)
                )
