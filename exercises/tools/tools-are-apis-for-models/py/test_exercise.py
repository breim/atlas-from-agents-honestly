import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = FIXTURE["policy"]
ENDPOINTS = FIXTURE["endpoints"]

CASES = (
    (
        "a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip",
        "a tool is a job, not an endpoint",
    ),
    (
        "an-identity-argument-is-rejected-however-it-is-named",
        "the rule that has no exceptions",
    ),
    (
        "a-field-no-endpoint-in-the-job-produces-is-rejected",
        "a tool cannot return what it never fetched",
    ),
    ("a-description-too-thin-to-route-on-is-rejected", "the description is the interface"),
    ("a-tool-that-states-no-boundary-is-warned-not-rejected", "say what it is not for"),
    ("wrapping-every-endpoint-one-to-one-buys-nothing", "the step to skip"),
)


def everything() -> int:
    return sum(sum(e["fields"].values()) for e in ENDPOINTS)


class ToolsAreApisForModels(unittest.TestCase):
    def setUp(self):
        self.surface = load_impl(__file__).surface

    def go(self, entry: dict, design: list = None, policy: dict = None) -> dict:
        return self.surface(
            ENDPOINTS,
            entry["design"] if design is None else design,
            policy or POLICY,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_curated_tool_is_never_more_expensive_than_its_endpoints(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertLessEqual(
                    outcome["curated"]["tokens"], outcome["generated"]["tokens"]
                )
                self.assertLessEqual(
                    outcome["curated"]["roundTrips"], outcome["generated"]["roundTrips"]
                )

    def test_consolidating_a_chain_trades_endpoints_for_round_trips(self):
        entry = case(
            FIXTURE, "a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip"
        )
        outcome = self.go(entry)
        tool = outcome["tools"][0]
        self.assertEqual(tool["roundTrips"], 1)
        self.assertGreater(tool["endpoints"], 1)
        self.assertLess(outcome["curated"]["tokens"] * 10, outcome["generated"]["tokens"])

    def test_every_tool_costs_exactly_one_round_trip(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for tool in self.go(entry)["tools"]:
                    self.assertEqual(tool["roundTrips"], 1)
                    self.assertGreaterEqual(tool["endpoints"], 1)

    def test_no_accepted_tool_takes_an_identity_argument(self):
        for entry in FIXTURE["cases"]:
            for identity in POLICY["identityFields"]:
                with self.subTest(f"{entry['id']}/{identity}"):
                    poisoned = [
                        {**d, "args": d["args"] + [identity]} for d in entry["design"]
                    ]
                    outcome = self.go(entry, poisoned)
                    self.assertEqual(outcome["tools"], [])
                    self.assertEqual(len(outcome["rejected"]), len(entry["design"]))
                    for rejection in outcome["rejected"]:
                        self.assertTrue(
                            any(
                                field in rejection["reason"]
                                for field in POLICY["identityFields"]
                            )
                        )

    def test_an_accepted_tool_only_returns_fields_its_job_produces(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for tool in outcome["tools"]:
                    design = next(
                        d for d in entry["design"] if d["name"] == tool["name"]
                    )
                    available = set()
                    for endpoint_id in design["job"]:
                        endpoint = next(
                            e for e in ENDPOINTS if e["id"] == endpoint_id
                        )
                        available.update(endpoint["fields"])
                    for field in tool["returns"]:
                        self.assertIn(field, available)

    def test_a_tool_is_accepted_or_rejected_never_both(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                seen = [t["name"] for t in outcome["tools"]] + [
                    r["name"] for r in outcome["rejected"]
                ]
                self.assertEqual(
                    sorted(seen), sorted(d["name"] for d in entry["design"])
                )
                accepted = {t["name"] for t in outcome["tools"]}
                for item in outcome["rejected"]:
                    self.assertTrue(item["reason"])
                    self.assertNotIn(item["name"], accepted)

    def test_the_totals_are_exactly_the_accepted_tools(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["curated"]["toolCount"], len(outcome["tools"])
                )
                self.assertEqual(
                    outcome["curated"]["tokens"],
                    sum(t["tokens"] for t in outcome["tools"]),
                )
                self.assertEqual(outcome["generated"]["tokens"], everything())
                self.assertEqual(outcome["generated"]["toolCount"], len(ENDPOINTS))

    def test_the_generated_surface_does_not_depend_on_the_design(self):
        totals = {
            tuple(sorted(self.go(entry)["generated"].items()))
            for entry in FIXTURE["cases"]
        }
        self.assertEqual(len(totals), 1)

    def test_a_thin_description_is_rejected_at_the_declared_threshold(self):
        entry = case(
            FIXTURE, "a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip"
        )
        minimum = POLICY["minDescriptionWords"]
        for words in (minimum - 1, minimum, minimum + 1):
            with self.subTest(words):
                design = [
                    {**d, "description": " ".join(["word"] * words)}
                    for d in entry["design"]
                ]
                outcome = self.go(entry, design)
                self.assertEqual(bool(outcome["rejected"]), words < minimum)

    def test_a_missing_boundary_warns_and_a_stated_one_does_not(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                accepted = {t["name"] for t in outcome["tools"]}
                for design in entry["design"]:
                    warned = any(
                        w.startswith(f"{design['name']} states no boundary")
                        for w in outcome["warnings"]
                    )
                    self.assertEqual(
                        warned,
                        design["name"] in accepted and not design.get("notFor"),
                    )

    def test_a_surface_past_the_live_budget_is_warned_by_name(self):
        entry = case(FIXTURE, "wrapping-every-endpoint-one-to-one-buys-nothing")
        outcome = self.go(entry)
        self.assertGreater(len(outcome["tools"]), POLICY["maxLiveTools"])
        self.assertTrue(
            any(f"{len(outcome['tools'])} tools" in w for w in outcome["warnings"])
        )
        roomy = self.go(
            entry, None, {**POLICY, "maxLiveTools": len(outcome["tools"])}
        )
        self.assertFalse(any("live budget" in w for w in roomy["warnings"]))
