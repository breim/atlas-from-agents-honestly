import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CATALOGUE = FIXTURE["catalogue"]

CASES = (
    (
        "a-transient-failure-is-retried-and-never-seen",
        "waiting fixes it, so nobody else hears",
    ),
    ("a-rate-limit-carries-its-own-schedule", "the header exists here and nowhere later"),
    (
        "a-context-length-error-is-permanent-not-transient",
        "three more rejections, billed each time",
    ),
    ("the-model-mistake-goes-back-into-the-transcript", "written as an instruction"),
    ("your-bug-stays-in-your-logs", "the same class, the opposite audience"),
    (
        "a-refusal-is-policy-and-is-not-rephrased",
        "a workaround for a control is not a fix",
    ),
    ("budget-exhaustion-is-not-an-error", "the system working, at ERROR"),
    ("the-error-rate-is-a-floor", "a 200, a clean trace, a wrong answer"),
    ("one-root-cause-lands-in-four-classes", "four dashboards, one incident"),
    ("an-hour-with-no-failures", "nothing raised, nothing to route"),
)


class ErrorTaxonomy(unittest.TestCase):
    def setUp(self):
        self.route = load_impl(__file__).route

    def run_failures(self, failures: list, catalogue: dict = None) -> dict:
        return self.route(failures, catalogue or CATALOGUE)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_failures(entry["failures"]), entry["result"])

    def test_one_routing_per_failure_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                routed = self.run_failures(entry["failures"])["routed"]
                self.assertEqual(
                    [r["id"] for r in routed], [f["id"] for f in entry["failures"]]
                )

    def test_only_a_transient_failure_is_ever_retried(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for routed in self.run_failures(entry["failures"])["routed"]:
                    self.assertEqual(routed["retryable"], routed["class"] == "transient")

    def test_only_a_policy_failure_ever_escalates(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for routed in self.run_failures(entry["failures"])["routed"]:
                    self.assertEqual(routed["escalates"], routed["class"] == "policy")

    def test_a_recovered_transient_failure_is_never_shown_to_the_model(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for routed in self.run_failures(entry["failures"])["routed"]:
                    if routed["class"] != "transient":
                        continue
                    self.assertIsNone(routed["modelFacing"])

    def test_the_model_sees_an_error_exactly_when_it_can_act(self):
        for entry in FIXTURE["cases"]:
            routed = self.run_failures(entry["failures"])["routed"]
            for index, failure in enumerate(entry["failures"]):
                with self.subTest(f"{entry['id']}:{failure['code']}"):
                    catalogued = CATALOGUE[failure["code"]]
                    actionable = catalogued["class"] in ("policy", "budget") or (
                        catalogued["class"] == "permanent"
                        and catalogued["blame"] == "model"
                    )
                    owed = failure["instruction"] if actionable else None
                    self.assertEqual(routed[index]["modelFacing"], owed)

    def test_a_retry_schedule_only_survives_on_something_retryable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                impatient = [
                    {**failure, "retryAfterMs": 9000} for failure in entry["failures"]
                ]
                for routed in self.run_failures(impatient)["routed"]:
                    owed = 9000 if routed["class"] == "transient" else None
                    self.assertEqual(routed["retryAfterMs"], owed)

    def test_budget_and_semantic_never_reach_the_error_rate(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_failures(entry["failures"])
                for item in result["routed"]:
                    silent = item["class"] in ("budget", "semantic")
                    self.assertEqual(
                        item["id"] in result["countedInErrorRate"], not silent
                    )

    def test_nothing_semantic_is_ever_retried_escalated_or_shown(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for routed in self.run_failures(entry["failures"])["routed"]:
                    if routed["class"] != "semantic":
                        continue
                    self.assertEqual(
                        [
                            routed["retryable"],
                            routed["escalates"],
                            routed["modelFacing"],
                        ],
                        [False, False, None],
                    )

    def test_reclassifying_a_code_moves_only_the_failures_that_carry_it(self):
        for entry in FIXTURE["cases"]:
            before = self.run_failures(entry["failures"])["routed"]
            for code in {failure["code"] for failure in entry["failures"]}:
                with self.subTest(f"{entry['id']}:{code}"):
                    reclassified = {
                        **CATALOGUE,
                        code: {"class": "transient", "blame": "world"},
                    }
                    after = self.run_failures(entry["failures"], reclassified)["routed"]
                    for index, item in enumerate(before):
                        if entry["failures"][index]["code"] == code:
                            continue
                        self.assertEqual(after[index], item)
