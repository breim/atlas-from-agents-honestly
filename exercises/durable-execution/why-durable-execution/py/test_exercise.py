import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-first-run-executes-every-step", "an empty journal means everything runs"),
    ("a-crash-keeps-the-effects-that-completed", "the journal outlives the process"),
    ("recovery-does-not-re-run-a-journalled-effect", "the credit is not issued twice"),
    ("a-full-journal-makes-no-calls-at-all", "catching up is free"),
    (
        "a-journal-that-does-not-match-the-code-is-a-replay-error",
        "the runtime lost its place",
    ),
    (
        "a-crash-before-the-first-effect-journals-nothing",
        "nothing happened, so nothing is recorded",
    ),
    (
        "a-crash-mid-recovery-only-journals-the-new-effect",
        "replay writes nothing; execution does",
    ),
    ("a-program-with-no-effects-completes-immediately", "no effects, no journal"),
)


class WhyDurableExecution(unittest.TestCase):
    def setUp(self):
        self.run_impl = load_impl(__file__).run

    @staticmethod
    def program_of(entry: dict) -> list:
        return entry.get("program", FIXTURE["program"])

    def execute(self, entry: dict) -> dict:
        return self.run_impl(
            self.program_of(entry), entry["journal"], entry["crashAfter"]
        )

    @staticmethod
    def names(steps: list) -> list:
        return [step["name"] for step in steps]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.execute(entry), entry["result"])

    def test_a_step_already_in_the_journal_is_never_executed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                recorded = set(self.names(entry["journal"]))
                for name in self.execute(entry)["executed"]:
                    self.assertNotIn(name, recorded)

    def test_the_journal_is_only_ever_appended_to(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                after = self.execute(entry)["journal"]
                self.assertEqual(after[: len(entry["journal"])], entry["journal"])

    def test_the_journal_out_is_the_journal_in_plus_what_executed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.execute(entry)
                self.assertEqual(
                    self.names(result["journal"]),
                    self.names(entry["journal"]) + result["executed"],
                )

    def test_a_run_that_did_not_complete_returns_nothing(self):
        for entry in FIXTURE["cases"]:
            result = self.execute(entry)
            if result["status"] == "completed":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["results"], [])

    def test_a_completed_run_returns_one_result_per_step(self):
        for entry in FIXTURE["cases"]:
            result = self.execute(entry)
            if result["status"] != "completed":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(
                    result["results"],
                    [step["result"] for step in self.program_of(entry)],
                )

    def test_a_divergent_journal_is_left_exactly_as_it_was_found(self):
        for entry in FIXTURE["cases"]:
            result = self.execute(entry)
            if result["status"] != "non_determinism":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["journal"], entry["journal"])
                self.assertEqual(result["executed"], [])

    def test_replaying_a_completed_run_executes_nothing(self):
        for entry in FIXTURE["cases"]:
            first = self.execute(entry)
            if first["status"] != "completed":
                continue
            with self.subTest(entry["id"]):
                again = self.run_impl(
                    self.program_of(entry), first["journal"], entry["crashAfter"]
                )
                self.assertEqual(again["executed"], [])
                self.assertEqual(again["results"], first["results"])

    def test_crashing_after_every_effect_still_runs_each_one_exactly_once(self):
        for entry in FIXTURE["cases"]:
            program = self.program_of(entry)
            clean = self.run_impl(program, [], len(program))
            if clean["status"] != "completed":
                continue
            with self.subTest(entry["id"]):
                executed = []
                journal = []
                attempt = self.run_impl(program, journal, 1)
                for _ in range(len(program) + 1):
                    if attempt["status"] != "crashed":
                        break
                    executed.extend(attempt["executed"])
                    journal = attempt["journal"]
                    attempt = self.run_impl(program, journal, 1)
                executed.extend(attempt["executed"])

                self.assertEqual(attempt["status"], "completed")
                self.assertEqual(attempt["results"], clean["results"])
                self.assertEqual(executed, self.names(program))
