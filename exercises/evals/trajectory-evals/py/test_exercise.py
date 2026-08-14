import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-clean-run-scores-everything", "the run that worked"),
    ("a-missing-lookup-is-a-recall-failure", "a confident answer from incomplete data"),
    (
        "an-unnecessary-call-is-a-precision-failure",
        "context rented for the rest of the run",
    ),
    ("seven-steps-where-three-would-do", "right answer, wasteful path"),
    ("retrying-the-same-bad-call-is-a-loop", "the error text selected no branch"),
    (
        "fixing-the-argument-the-error-named-is-not-a-loop",
        "that is recovery, not repetition",
    ),
    (
        "refunding-before-verifying-is-a-policy-violation",
        "the effect preceded the decision",
    ),
    ("the-same-two-calls-in-the-policy-order-are-fine", "order as policy, satisfied"),
    (
        "an-effect-with-no-decision-at-all-is-a-violation",
        "a missing gate is not a late gate",
    ),
    ("order-that-is-not-policy-is-not-scored", "the model chooses the sequence"),
    ("a-run-that-called-nothing-scores-no-recall", "nothing looked up, nothing known"),
)


class TrajectoryEvals(unittest.TestCase):
    def setUp(self):
        self.score = load_impl(__file__).score

    def run_case(self, entry: dict, calls: list = None) -> dict:
        return self.score(entry["calls"] if calls is None else calls, entry["spec"])

    @staticmethod
    def tools(calls: list) -> set:
        return {call["tool"] for call in calls}

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_recall_is_full_exactly_when_every_required_tool_was_called(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                complete = all(
                    tool in self.tools(entry["calls"]) for tool in entry["spec"]["required"]
                )
                self.assertEqual(self.run_case(entry)["recallBps"] == 10000, complete)

    def test_precision_is_full_exactly_when_nothing_unrequired_was_called(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                lean = all(
                    tool in entry["spec"]["required"] for tool in self.tools(entry["calls"])
                )
                self.assertEqual(self.run_case(entry)["precisionBps"] == 10000, lean)

    def test_one_more_unnecessary_call_never_raises_precision(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                extra = {
                    "tool": "unrelated_tool",
                    "args": "x",
                    "error": None,
                    "contributed": False,
                }
                after = self.run_case(entry, entry["calls"] + [extra])
                self.assertLessEqual(after["precisionBps"], before["precisionBps"])
                self.assertGreaterEqual(after["recallBps"], before["recallBps"])

    def test_dropping_a_required_call_never_raises_recall(self):
        for entry in FIXTURE["cases"]:
            for tool in entry["spec"]["required"]:
                with self.subTest(f"{entry['id']}:{tool}"):
                    without = [c for c in entry["calls"] if c["tool"] != tool]
                    self.assertLessEqual(
                        self.run_case(entry, without)["recallBps"],
                        self.run_case(entry)["recallBps"],
                    )

    def test_step_efficiency_never_claims_more_than_a_hundred_percent(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                value = self.run_case(entry)["stepEfficiencyBps"]
                self.assertGreaterEqual(value, 0)
                self.assertLessEqual(value, 10000)

    def test_redundancy_is_the_share_of_calls_that_contributed_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                wasted = sum(1 for c in entry["calls"] if not c["contributed"])
                total = len(entry["calls"])
                share = 0 if total == 0 else floor(wasted * 10000 / total + 0.5)
                self.assertEqual(self.run_case(entry)["redundantBps"], share)

    def test_loop_escape_is_full_exactly_when_no_failure_was_repeated(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                seen = set()
                repeated = False
                for call in entry["calls"]:
                    key = (call["tool"], call["args"], call["error"])
                    if call["error"] is not None and key in seen:
                        repeated = True
                    seen.add(key)
                self.assertEqual(
                    self.run_case(entry)["loopEscapeBps"] == 10000, not repeated
                )

    def test_changing_the_argument_on_every_retry_escapes_the_loop(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                tuned = [
                    {**call, "args": f"{call['args']}-{index}"}
                    for index, call in enumerate(entry["calls"])
                ]
                self.assertEqual(self.run_case(entry, tuned)["loopEscapeBps"], 10000)

    def test_a_policy_pair_is_violated_exactly_when_the_effect_has_no_decision(self):
        for entry in FIXTURE["cases"]:
            violations = self.run_case(entry)["policyViolations"]
            for before, after in entry["spec"]["orderPolicy"]:
                with self.subTest(f"{entry['id']}:{before}->{after}"):
                    calls = entry["calls"]
                    decision = next(
                        (i for i, c in enumerate(calls) if c["tool"] == before), -1
                    )
                    effect = next(
                        (i for i, c in enumerate(calls) if c["tool"] == after), -1
                    )
                    broken = effect != -1 and (decision == -1 or decision > effect)
                    self.assertEqual(f"{before}->{after}" in violations, broken)

    def test_reordering_calls_no_policy_names_changes_nothing_scored(self):
        for entry in FIXTURE["cases"]:
            if entry["spec"]["orderPolicy"]:
                continue
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                after = self.run_case(entry, list(reversed(entry["calls"])))
                self.assertEqual(after["recallBps"], before["recallBps"])
                self.assertEqual(after["precisionBps"], before["precisionBps"])
                self.assertEqual(after["stepEfficiencyBps"], before["stepEfficiencyBps"])
                self.assertEqual(after["policyViolations"], [])
