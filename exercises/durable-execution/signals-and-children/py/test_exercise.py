import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("signal-with-start-creates-the-run-it-needs", "the entity id is the workflow id"),
    (
        "a-second-signal-with-start-finds-the-existing-run",
        "no second run, no race, no lookup table",
    ),
    ("nothing-reaches-a-workflow-that-was-never-started", "a cold entity has no mailbox"),
    ("a-query-adds-nothing-to-the-history", "refreshing the console is free"),
    ("an-update-tells-the-caller-what-happened", "the person who clicked Approve is told"),
    (
        "a-rejected-update-is-never-recorded",
        "the validator fires before anything is written",
    ),
    (
        "an-update-out-of-phase-is-rejected-by-the-validator",
        "approving twice is not a thing",
    ),
    ("a-signal-is-accepted-whether-or-not-it-did-anything", "accepted is not acted on"),
    (
        "an-escalated-run-refuses-the-approval-it-was-waiting-for",
        "three days is three days",
    ),
    ("an-empty-mailbox-leaves-a-cold-workflow-cold", "nothing in, nothing out"),
)


class SignalsAndChildren(unittest.TestCase):
    def setUp(self):
        self.apply = load_impl(__file__).apply

    def run_messages(self, messages: list) -> dict:
        return self.apply(messages, FIXTURE["limit"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_messages(entry["messages"]), entry["result"])

    def test_one_response_per_message_always(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_messages(entry["messages"])
                self.assertEqual(len(result["responses"]), len(entry["messages"]))

    def test_dropping_every_query_changes_neither_history_nor_state(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                with_queries = self.run_messages(entry["messages"])
                without = self.run_messages(
                    [m for m in entry["messages"] if m["kind"] != "query"]
                )
                self.assertEqual(without["history"], with_queries["history"])
                self.assertEqual(without["state"], with_queries["state"])

    def test_a_query_answers_with_the_phase_the_workflow_is_in(self):
        for entry in FIXTURE["cases"]:
            responses = self.run_messages(entry["messages"])["responses"]
            for index, message in enumerate(entry["messages"]):
                if message["kind"] != "query" or not responses[index]["ok"]:
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    up_to = self.run_messages(entry["messages"][: index + 1])
                    self.assertEqual(responses[index]["value"], up_to["state"]["phase"])

    def test_a_message_that_was_refused_leaves_no_trace(self):
        for entry in FIXTURE["cases"]:
            for index in range(len(entry["messages"])):
                before = self.run_messages(entry["messages"][:index])
                after = self.run_messages(entry["messages"][: index + 1])
                if after["responses"][index]["ok"]:
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    self.assertEqual(after["history"], before["history"])
                    self.assertEqual(after["state"], before["state"])

    def test_a_signal_never_reports_an_outcome(self):
        for entry in FIXTURE["cases"]:
            responses = self.run_messages(entry["messages"])["responses"]
            for index, message in enumerate(entry["messages"]):
                if message["kind"] in ("query", "update"):
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    self.assertNotIn("value", responses[index])

    def test_an_accepted_update_always_reports_the_outcome(self):
        for entry in FIXTURE["cases"]:
            responses = self.run_messages(entry["messages"])["responses"]
            for index, message in enumerate(entry["messages"]):
                if message["kind"] != "update" or not responses[index]["ok"]:
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    up_to = self.run_messages(entry["messages"][: index + 1])
                    self.assertEqual(responses[index]["value"], up_to["state"]["phase"])

    def test_an_accepted_update_never_took_more_than_the_limit(self):
        for entry in FIXTURE["cases"]:
            result = self.run_messages(entry["messages"])
            for index, message in enumerate(entry["messages"]):
                if message["kind"] != "update" or not result["responses"][index]["ok"]:
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    self.assertLessEqual(message["amountCents"], FIXTURE["limit"])
            if result["state"]["approvedCents"] is not None:
                self.assertLessEqual(result["state"]["approvedCents"], FIXTURE["limit"])

    def test_the_history_only_ever_grows_one_message_at_a_time(self):
        for entry in FIXTURE["cases"]:
            for index in range(len(entry["messages"])):
                with self.subTest(f"{entry['id']}:{index}"):
                    before = self.run_messages(entry["messages"][:index])["history"]
                    after = self.run_messages(entry["messages"][: index + 1])["history"]
                    self.assertEqual(after[: len(before)], before)
                    self.assertLessEqual(len(after) - len(before), 2)

    def test_a_run_is_only_ever_started_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                history = self.run_messages(entry["messages"])["history"]
                self.assertLessEqual(history.count("started"), 1)
