import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]

CASES = (
    ("one-owner-per-class-means-no-multiplication", "one layer owns the recovery"),
    ("three-owners-multiply-to-twenty-seven", "nested retries multiply, never add"),
    ("the-model-is-a-layer-nobody-configured", "not in the config, in the traffic"),
    ("a-permanent-failure-is-retried-nowhere", "the same rejection, billed again"),
    (
        "the-call-timeout-is-the-smaller-of-its-own-and-what-remains",
        "per-call timeouts do not compose",
    ),
    ("a-generous-remainder-does-not-lengthen-a-call", "a budget is a ceiling, not a target"),
    ("a-passed-deadline-admits-nothing", "the user gave up ninety seconds ago"),
    (
        "the-attempt-ceiling-belongs-to-the-run",
        "not sixty attempts nobody reasoned about",
    ),
    (
        "an-exhausted-retry-budget-fails-through",
        "retrying converts one failure into three",
    ),
    ("a-budget-exactly-at-the-line-is-spent", "the boundary is spent, not spare"),
    ("no-traffic-yet-admits-the-first-retry", "an empty window is not an exhausted one"),
)


class TimeoutsAndRetries(unittest.TestCase):
    def setUp(self):
        self.plan = load_impl(__file__).plan

    @staticmethod
    def config_for(entry: dict, **overrides) -> dict:
        config = dict(CONFIG)
        if "ownership" in entry:
            config["ownership"] = entry["ownership"]
        config.update(overrides)
        return config

    def run_case(self, entry: dict, request: dict = None, **overrides) -> dict:
        return self.plan(
            request or entry["request"], self.config_for(entry, **overrides)
        )

    def owners_for(self, entry: dict) -> list:
        return self.config_for(entry)["ownership"].get(
            entry["request"]["failureClass"], []
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_layer_that_does_not_own_the_class_gets_one_attempt(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owners = self.owners_for(entry)
                for layer in self.run_case(entry)["layers"]:
                    if layer["name"] in owners:
                        continue
                    self.assertEqual(layer["attempts"], 1)

    def test_an_owning_layer_keeps_its_configured_attempts(self):
        configured = {layer["name"]: layer["attempts"] for layer in CONFIG["layers"]}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owners = self.owners_for(entry)
                for layer in self.run_case(entry)["layers"]:
                    if layer["name"] not in owners:
                        continue
                    self.assertEqual(layer["attempts"], configured[layer["name"]])

    def test_the_total_is_the_product_of_every_layer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                product = entry["request"]["modelRetries"]
                for layer in result["layers"]:
                    product *= layer["attempts"]
                self.assertEqual(result["totalCalls"], product)

    def test_collapsing_every_configured_layer_cannot_bound_the_model(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                collapsed = self.run_case(entry, ownership={})
                self.assertGreaterEqual(
                    collapsed["totalCalls"], entry["request"]["modelRetries"]
                )
                chattier = self.run_case(
                    entry,
                    {
                        **entry["request"],
                        "modelRetries": entry["request"]["modelRetries"] + 1,
                    },
                    ownership={},
                )
                self.assertGreater(chattier["totalCalls"], collapsed["totalCalls"])

    def test_a_second_owner_never_lowers_the_number_of_calls(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                everyone = {
                    entry["request"]["failureClass"]: [
                        layer["name"] for layer in CONFIG["layers"]
                    ]
                }
                after = self.run_case(entry, ownership=everyone)
                self.assertGreaterEqual(after["totalCalls"], before["totalCalls"])
                self.assertEqual(after["multiplied"], len(CONFIG["layers"]) > 1)

    def test_a_call_never_gets_more_time_than_it_asked_for_or_the_run_has(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                timeout = self.run_case(entry)["timeoutMs"]
                self.assertLessEqual(timeout, entry["request"]["preferredTimeoutMs"])
                self.assertLessEqual(timeout, entry["request"]["remainingMs"])

    def test_a_call_always_leaves_room_for_the_run_to_finish(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                timeout = self.run_case(entry)["timeoutMs"]
                if entry["request"]["remainingMs"] <= 0:
                    self.assertEqual(timeout, 0)
                    continue
                self.assertGreaterEqual(entry["request"]["remainingMs"] - timeout, 0)

    def test_a_retry_is_admitted_exactly_when_no_reason_refuses_it(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(result["retryAdmitted"], result["reason"] is None)

    def test_a_class_nobody_owns_is_never_retried(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                orphan = self.run_case(entry, ownership={})
                self.assertFalse(orphan["retryAdmitted"])
                self.assertEqual(orphan["reason"], "not_retryable")

    def test_a_fuller_retry_window_never_admits_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)["retryAdmitted"]
                busier = self.run_case(
                    entry,
                    {
                        **entry["request"],
                        "retriesInWindow": entry["request"]["callsInWindow"],
                    },
                )
                self.assertTrue(not busier["retryAdmitted"] or before)
