import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

RANK = {"auto": 0, "notify": 1, "approve": 2, "dual": 3}
STRICTER = {
    "reversible": "costly",
    "costly": "irreversible",
    "irreversible": "irreversible",
}

CASES = (
    ("a-read-runs-autonomously", "four hundred reads cost nobody anything"),
    ("a-small-refund-needs-one-approval", "irreversible and small is still irreversible"),
    (
        "a-larger-refund-at-the-same-tool-needs-two-people",
        "risk is the cell, not the tool",
    ),
    ("the-amount-threshold-is-inclusive", "exactly at the line is over it"),
    ("a-template-changes-the-action-not-the-tool", "the redesign, in one case"),
    ("publishing-widely-costs-more-than-reading", "blast radius comes from the arguments"),
    ("the-costly-row-escalates-with-scope", "one row, three postures"),
    ("the-blast-radius-is-capped-at-large", "there is nothing above large"),
    ("gating-every-reply-does-not-fit-the-day", "the arithmetic nobody runs"),
    ("redesigning-the-action-fits-the-same-day", "change the action, not the bar"),
    ("an-atlas-day-fits-inside-the-budget", "a whole day, inside the ceiling"),
    ("a-day-with-no-calls-costs-nothing", "no calls, no attention"),
)


class RiskTiers(unittest.TestCase):
    def setUp(self):
        self.assess = load_impl(__file__).assess

    def run_calls(self, calls: list, catalogue: dict = None) -> dict:
        return self.assess(
            calls, catalogue or FIXTURE["catalogue"], FIXTURE["capacity"]
        )

    def posture_of(self, call: dict, catalogue: dict = None) -> str:
        return self.run_calls([call], catalogue)["decisions"][0]["posture"]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_calls(entry["calls"]), entry["result"])

    def test_one_decision_per_call_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                decisions = self.run_calls(entry["calls"])["decisions"]
                self.assertEqual(
                    [d["tool"] for d in decisions],
                    [c["tool"] for c in entry["calls"]],
                )

    def test_the_same_axes_always_give_the_same_posture(self):
        seen = {}
        for entry in FIXTURE["cases"]:
            decisions = self.run_calls(entry["calls"])["decisions"]
            for call, decision in zip(entry["calls"], decisions):
                tool = FIXTURE["catalogue"][call["tool"]]
                reversibility = tool["reversibility"]
                if call["templated"] and "templatedReversibility" in tool:
                    reversibility = tool["templatedReversibility"]
                radius = min(
                    len([e for e in tool["radiusThresholds"] if call["scope"] >= e]), 2
                )
                key = f"{reversibility}:{radius}"
                with self.subTest(f"{entry['id']}:{key}"):
                    if key in seen:
                        self.assertEqual(decision["posture"], seen[key])
                    seen[key] = decision["posture"]

    def test_a_less_reversible_action_never_gets_a_laxer_posture(self):
        for entry in FIXTURE["cases"]:
            for call in entry["calls"]:
                with self.subTest(f"{entry['id']}:{call['tool']}"):
                    tool = FIXTURE["catalogue"][call["tool"]]
                    harder = {
                        **FIXTURE["catalogue"],
                        call["tool"]: {
                            **tool,
                            "reversibility": STRICTER[tool["reversibility"]],
                        },
                    }
                    self.assertGreaterEqual(
                        RANK[self.posture_of(call, harder)],
                        RANK[self.posture_of(call)],
                    )

    def test_a_wider_blast_radius_never_gets_a_laxer_posture(self):
        for entry in FIXTURE["cases"]:
            for call in entry["calls"]:
                with self.subTest(f"{entry['id']}:{call['tool']}"):
                    wider = {**call, "scope": call["scope"] + 1_000_000}
                    self.assertGreaterEqual(
                        RANK[self.posture_of(wider)], RANK[self.posture_of(call)]
                    )

    def test_an_approved_template_is_never_stricter_than_prose(self):
        for entry in FIXTURE["cases"]:
            for call in entry["calls"]:
                with self.subTest(f"{entry['id']}:{call['tool']}"):
                    templated = RANK[self.posture_of({**call, "templated": True})]
                    free_text = RANK[self.posture_of({**call, "templated": False})]
                    self.assertLessEqual(templated, free_text)

    def test_only_approve_and_dual_spend_a_reviewer_decision(self):
        cost = {"auto": 0, "notify": 0, "approve": 1, "dual": 2}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_calls(entry["calls"])
                spent = sum(
                    cost[decision["posture"]] * call["count"]
                    for decision, call in zip(result["decisions"], entry["calls"])
                )
                self.assertEqual(result["approvals"], spent)

    def test_affordable_is_exactly_whether_the_decisions_fit(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_calls(entry["calls"])
                self.assertEqual(
                    result["affordable"], result["approvals"] <= FIXTURE["capacity"]
                )

    def test_more_of_the_same_calls_never_asks_for_fewer_decisions(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                busier = [{**call, "count": call["count"] * 2} for call in entry["calls"]]
                self.assertGreaterEqual(
                    self.run_calls(busier)["approvals"],
                    self.run_calls(entry["calls"])["approvals"],
                )
