import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CATALOGUE = FIXTURE["catalogue"]
WORLD = FIXTURE["world"]

CASES = (
    ("a-single-lookup-takes-two-requests", "one answer, two billed requests"),
    (
        "a-model-that-answers-without-a-tool-costs-one-request",
        "no tool, no round trip",
    ),
    ("parallel-calls-return-in-one-user-message", "two calls, one message"),
    ("an-error-is-a-message-not-a-missing-result", "a failure the model can read"),
    ("one-failure-does-not-drop-the-other-result", "never silently drop a result"),
    (
        "an-unknown-tool-is-an-error-the-model-can-read",
        "a name that is not in the catalogue",
    ),
    (
        "a-missing-argument-is-an-error-the-model-can-read",
        "a call with garbage arguments",
    ),
    ("the-if-is-not-a-while", "the model asks again and nothing is listening"),
)


def tool_uses(content: list) -> list:
    return [block for block in content if block["type"] == "tool_use"]


class FirstTools(unittest.TestCase):
    def setUp(self):
        self.answer = load_impl(__file__).answer

    def run_case(self, entry: dict, script: list = None) -> dict:
        return self.answer(
            entry["ticket"],
            entry["script"] if script is None else script,
            CATALOGUE,
            WORLD,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_issued_id_comes_back_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                transcript = self.run_case(entry)["transcript"]
                for index, message in enumerate(transcript):
                    if message["role"] != "assistant":
                        continue
                    issued = [b["id"] for b in tool_uses(message["content"])]
                    if not issued:
                        continue
                    results = transcript[index + 1]["content"]
                    self.assertEqual([r["toolUseId"] for r in results], issued)

    def test_a_failing_tool_returns_a_result_rather_than_throwing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for message in self.run_case(entry)["transcript"]:
                    if message["role"] != "user" or isinstance(message["content"], str):
                        continue
                    for result in message["content"]:
                        failed = result["content"].startswith("Error: ")
                        self.assertEqual(result.get("isError", False), failed)

    def test_every_result_for_a_turn_arrives_in_one_user_message(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                transcript = self.run_case(entry)["transcript"]
                bearing = [
                    m
                    for m in transcript
                    if m["role"] == "user" and not isinstance(m["content"], str)
                ]
                self.assertLessEqual(len(bearing), 1)
                issued = [
                    block
                    for m in transcript
                    if m["role"] == "assistant"
                    for block in tool_uses(m["content"])
                ]
                for message in bearing:
                    self.assertEqual(len(message["content"]), len(issued))

    def test_the_assistant_turn_is_echoed_back_verbatim(self):
        for entry in FIXTURE["cases"]:
            if entry["script"][0]["stopReason"] != "tool_use":
                continue
            with self.subTest(entry["id"]):
                transcript = self.run_case(entry)["transcript"]
                self.assertEqual(transcript[1]["content"], entry["script"][0]["content"])

    def test_results_enter_the_transcript_as_user_content(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for message in self.run_case(entry)["transcript"]:
                    if isinstance(message["content"], str):
                        continue
                    if any(b["type"] == "tool_result" for b in message["content"]):
                        self.assertEqual(message["role"], "user")

    def test_the_second_request_resends_everything_the_first_one_sent(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                requests = result["requests"]
                self.assertEqual(
                    requests, [index * 2 + 1 for index in range(len(requests))]
                )
                self.assertEqual(
                    result["transcript"][0],
                    {"role": "user", "content": entry["ticket"]["body"]},
                )
                for index in range(1, len(requests)):
                    self.assertGreater(requests[index], requests[index - 1])

    def test_one_round_of_tool_use_no_matter_how_many_times_the_model_asks(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertLessEqual(result["rounds"], 1)
                self.assertEqual(len(result["requests"]), result["rounds"] + 1)

    def test_an_unanswered_run_says_so_instead_of_inventing_an_answer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                last = entry["script"][len(result["requests"]) - 1]
                stalled = last["stopReason"] == "tool_use"
                self.assertEqual(
                    result["outcome"], "unresolved" if stalled else "answered"
                )
                self.assertEqual(result["answer"] is None, stalled)

    def test_a_model_that_never_stops_asking_never_gets_past_the_second_request(self):
        entry = case(FIXTURE, "the-if-is-not-a-while")
        insatiable = [
            {**response, "stopReason": "tool_use"} for response in entry["script"]
        ]
        result = self.run_case(entry, insatiable)
        self.assertEqual(len(result["requests"]), 2)
        self.assertEqual(result["outcome"], "unresolved")
