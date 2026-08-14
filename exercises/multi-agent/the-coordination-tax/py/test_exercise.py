import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
BASELINE = FIXTURE["baseline"]

CASES = (
    ("one-agent-pays-no-tax", "nothing crossed a boundary"),
    ("two-agents-are-two-quadratics-not-one-halved", "splitting multiplies the contexts"),
    ("fan-out-buys-latency-and-changes-no-tokens", "the only refund available"),
    ("a-thin-margin-cannot-absorb-the-multiplier", "parallel and still not worth it"),
    (
        "isolation-is-a-reason-that-does-not-need-parallelism",
        "a security property, bought with tokens",
    ),
    ("a-narrow-worker-cuts-the-multiplier", "the catalogue it never uses"),
    ("a-topology-with-no-agents-costs-nothing", "no agents, no tax"),
)


class TheCoordinationTax(unittest.TestCase):
    def setUp(self):
        self.price = load_impl(__file__).price

    def run_topology(self, topology: dict) -> dict:
        return self.price(topology, BASELINE, CONFIG)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_topology(entry["topology"]), entry["result"])

    def test_the_totals_are_the_sum_of_the_agents(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_topology(entry["topology"])
                self.assertEqual(
                    result["inputTokens"],
                    sum(a["inputTokens"] for a in result["perAgent"]),
                )
                self.assertEqual(
                    result["outputTokens"],
                    sum(a["outputTokens"] for a in result["perAgent"]),
                )
                self.assertEqual(
                    result["totalTokens"],
                    result["inputTokens"] + result["outputTokens"],
                )

    def test_an_inbound_summary_is_paid_on_every_turn(self):
        for entry in FIXTURE["cases"]:
            agents = entry["topology"]["agents"]
            for index, agent in enumerate(agents):
                with self.subTest(f"{entry['id']}:{agent['name']}"):
                    fatter = [
                        {**a, "inboundSummaryTokens": a["inboundSummaryTokens"] + 1000}
                        if position == index
                        else a
                        for position, a in enumerate(agents)
                    ]
                    after = self.run_topology({**entry["topology"], "agents": fatter})
                    before = self.run_topology(entry["topology"])
                    self.assertEqual(
                        after["perAgent"][index]["inputTokens"]
                        - before["perAgent"][index]["inputTokens"],
                        1000 * agent["turns"],
                    )

    def test_an_outbound_summary_is_written_once(self):
        for entry in FIXTURE["cases"]:
            agents = entry["topology"]["agents"]
            for index, agent in enumerate(agents):
                with self.subTest(f"{entry['id']}:{agent['name']}"):
                    wordier = [
                        {**a, "outboundSummaryTokens": a["outboundSummaryTokens"] + 1000}
                        if position == index
                        else a
                        for position, a in enumerate(agents)
                    ]
                    after = self.run_topology({**entry["topology"], "agents": wordier})
                    before = self.run_topology(entry["topology"])
                    self.assertEqual(
                        after["perAgent"][index]["outputTokens"]
                        - before["perAgent"][index]["outputTokens"],
                        1000,
                    )
                    self.assertEqual(
                        after["perAgent"][index]["inputTokens"],
                        before["perAgent"][index]["inputTokens"],
                    )

    def test_adding_an_agent_never_lowers_the_bill(self):
        extra = {
            "name": "extra",
            "prefixTokens": 5000,
            "turns": 3,
            "outputPerTurn": 100,
            "inboundSummaryTokens": 400,
            "outboundSummaryTokens": 200,
        }
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                bigger = self.run_topology(
                    {
                        **entry["topology"],
                        "agents": entry["topology"]["agents"] + [extra],
                    }
                )
                self.assertGreater(
                    bigger["totalTokens"],
                    self.run_topology(entry["topology"])["totalTokens"],
                )

    def test_the_token_bill_does_not_depend_on_parallelism(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                serial = self.run_topology({**entry["topology"], "parallel": False})
                concurrent = self.run_topology({**entry["topology"], "parallel": True})
                self.assertEqual(concurrent["totalTokens"], serial["totalTokens"])
                self.assertEqual(concurrent["costMicros"], serial["costMicros"])
                self.assertLessEqual(concurrent["latencyMs"], serial["latencyMs"])

    def test_the_multiplier_is_the_total_against_the_baseline(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_topology(entry["topology"])
                owed = (
                    0
                    if result["baselineTokens"] == 0
                    else floor(
                        result["totalTokens"] * 10000 / result["baselineTokens"] + 0.5
                    )
                )
                self.assertEqual(result["multiplierBps"], owed)

    def test_narrowing_a_prefix_never_raises_the_bill(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                lean = [
                    {**a, "prefixTokens": 0} for a in entry["topology"]["agents"]
                ]
                self.assertLessEqual(
                    self.run_topology({**entry["topology"], "agents": lean})["totalTokens"],
                    self.run_topology(entry["topology"])["totalTokens"],
                )

    def test_a_single_agent_is_always_worth_it(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_topology(entry["topology"])
                if len(entry["topology"]["agents"]) <= 1:
                    self.assertTrue(result["worthIt"])
                    self.assertEqual(result["reasons"], [])
                    continue
                affordable = (
                    entry["topology"]["taskValueMicros"] >= result["costMicros"]
                )
                justified = (
                    entry["topology"]["parallel"]
                    or entry["topology"]["isolationRequired"]
                )
                self.assertEqual(result["worthIt"], affordable and justified)

    def test_both_conditions_are_reported_when_both_fail(self):
        for entry in FIXTURE["cases"]:
            if len(entry["topology"]["agents"]) <= 1:
                continue
            with self.subTest(entry["id"]):
                doomed = self.run_topology(
                    {
                        **entry["topology"],
                        "parallel": False,
                        "isolationRequired": False,
                        "taskValueMicros": 0,
                    }
                )
                self.assertEqual(
                    doomed["reasons"],
                    ["value_below_cost", "not_parallel_and_no_isolation"],
                )
                self.assertFalse(doomed["worthIt"])
