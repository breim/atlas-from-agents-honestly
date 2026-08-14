import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]

CASES = (
    ("a-timeout-then-a-retry-moves-the-money-once", "the third outcome is the common one"),
    ("the-model-repeating-itself-is-told-that-nothing-changed", "never silent, for the model"),
    ("argument-order-does-not-change-the-key", "an unstable serialization is an unstable key"),
    ("a-different-amount-is-a-different-operation", "different, not repeated"),
    (
        "the-same-arguments-under-a-different-tool-are-a-different-operation",
        "the tool name is in the key",
    ),
    ("a-different-run-never-reuses-another-runs-key", "scoped to one job"),
    (
        "a-rejected-call-records-nothing-so-a-corrected-one-proceeds",
        "nothing happened, nothing recorded",
    ),
    ("a-key-supplied-by-the-model-is-refused", "keys come from your code"),
)


class Idempotency(unittest.TestCase):
    def setUp(self):
        module = load_impl(__file__)
        self.dispatch = module.dispatch
        self.key = module.idempotency_key

    def go(self, entry: dict, attempts: list = None, ledger: dict = None) -> dict:
        return self.dispatch(
            entry["attempts"] if attempts is None else attempts,
            ledger or {"entries": {}},
            CONFIG,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_each_operation_lands_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                landed = [
                    r for r in outcome["results"] if r["status"] in ("applied", "unknown")
                ]
                self.assertEqual(outcome["effects"], len(landed))
                self.assertEqual(
                    len(outcome["ledger"]["entries"]), outcome["effects"]
                )
                keys = [r["key"] for r in landed]
                self.assertEqual(len(set(keys)), len(keys))

    def test_repeating_an_attempt_never_adds_an_effect(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                once = self.go(entry)
                thrice = self.go(entry, entry["attempts"] * 3)
                self.assertEqual(thrice["effects"], once["effects"])
                self.assertEqual(thrice["ledger"], once["ledger"])

    def test_a_repeat_is_told_it_was_already_applied(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry, entry["attempts"] * 2)
                for result in outcome["results"]:
                    if result["status"] != "already-applied":
                        continue
                    self.assertTrue(result["note"])
                    self.assertIsNotNone(result["key"])

    def test_a_timeout_is_recorded_as_landed(self):
        entry = case(FIXTURE, "a-timeout-then-a-retry-moves-the-money-once")
        outcome = self.go(entry)
        self.assertEqual(outcome["results"][0]["status"], "unknown")
        self.assertIn(outcome["results"][0]["key"], outcome["ledger"]["entries"])
        self.assertEqual(outcome["results"][1]["status"], "already-applied")
        self.assertEqual(outcome["effects"], 1)

    def test_the_key_is_a_function_of_run_tool_and_arguments(self):
        length = CONFIG["keyLength"]
        args = {"accountId": "4471", "amountCents": 100}
        key = self.key("run-1", "issue_credit", args, length)
        self.assertEqual(key, self.key("run-1", "issue_credit", args, length))
        self.assertEqual(
            key,
            self.key("run-1", "issue_credit", {"amountCents": 100, "accountId": "4471"}, length),
        )
        self.assertNotEqual(key, self.key("run-2", "issue_credit", args, length))
        self.assertNotEqual(key, self.key("run-1", "reverse_credit", args, length))
        self.assertNotEqual(
            key,
            self.key("run-1", "issue_credit", {"accountId": "4471", "amountCents": 101}, length),
        )
        self.assertEqual(len(key), length)

    def test_every_distinct_operation_gets_its_own_key(self):
        for case_id in (
            "a-different-amount-is-a-different-operation",
            "the-same-arguments-under-a-different-tool-are-a-different-operation",
            "a-different-run-never-reuses-another-runs-key",
        ):
            entry = case(FIXTURE, case_id)
            with self.subTest(case_id):
                outcome = self.go(entry)
                self.assertEqual(outcome["effects"], len(entry["attempts"]))
                keys = [r["key"] for r in outcome["results"]]
                self.assertEqual(len(set(keys)), len(keys))

    def test_a_call_that_never_happened_records_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for result in outcome["results"]:
                    if result["status"] != "rejected":
                        continue
                    self.assertNotIn(result["key"], outcome["ledger"]["entries"])

    def test_a_rejection_leaves_the_key_free(self):
        entry = case(
            FIXTURE, "a-rejected-call-records-nothing-so-a-corrected-one-proceeds"
        )
        attempt = entry["attempts"][0]
        outcome = self.go(
            entry, [attempt, {**attempt, "id": "again", "transport": "ok"}]
        )
        self.assertEqual(outcome["results"][0]["status"], "rejected")
        self.assertEqual(outcome["results"][1]["status"], "applied")
        self.assertEqual(outcome["effects"], 1)
        self.assertEqual(outcome["results"][0]["key"], outcome["results"][1]["key"])

    def test_a_model_supplied_key_is_refused_and_changes_nothing(self):
        entry = case(FIXTURE, "a-key-supplied-by-the-model-is-refused")
        for reserved in CONFIG["reservedArgs"]:
            with self.subTest(reserved):
                poisoned = [
                    {**a, "args": {**a["args"], reserved: "made-up"}}
                    for a in entry["attempts"]
                ]
                outcome = self.go(entry, poisoned)
                self.assertEqual(outcome["effects"], 0)
                for result in outcome["results"]:
                    self.assertEqual(result["status"], "refused")
                    self.assertIsNone(result["key"])
                    self.assertTrue(
                        any(name in result["note"] for name in CONFIG["reservedArgs"])
                    )

    def test_an_existing_ledger_is_honoured(self):
        entry = case(FIXTURE, "the-model-repeating-itself-is-told-that-nothing-changed")
        first = self.go(entry, [entry["attempts"][0]])
        second = self.go(entry, entry["attempts"], first["ledger"])
        self.assertEqual(second["effects"], 0)
        for result in second["results"]:
            self.assertEqual(result["status"], "already-applied")

    def test_every_ledger_entry_names_its_run_and_tool(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for key, record in outcome["ledger"]["entries"].items():
                    self.assertEqual(len(key), CONFIG["keyLength"])
                    self.assertTrue(record["runId"])
                    self.assertTrue(record["tool"])
                    source = next(
                        a
                        for a in entry["attempts"]
                        if self.key(a["runId"], a["tool"], a["args"], CONFIG["keyLength"]) == key
                    )
                    self.assertEqual(record["runId"], source["runId"])
                    self.assertEqual(record["tool"], source["tool"])
