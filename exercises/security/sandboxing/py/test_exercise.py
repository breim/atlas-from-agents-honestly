import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
POLICY = FIXTURE["policy"]
SCOPE = FIXTURE["scope"]

CASES = (
    ("an-operation-inside-the-scope-is-served", "an operation, not a secret"),
    ("generated-code-cannot-call-what-the-model-could-not", "one authorization path"),
    ("an-unknown-operation-is-not-an-operation", "the list is the interface"),
    (
        "an-operation-outside-the-argument-scope-is-refused",
        "the class was fine; the arguments were not",
    ),
    ("the-same-operation-on-this-order-is-served", "the same call, correctly aimed"),
    ("there-is-no-way-to-ask-for-a-secret", "nothing to steal after an escape"),
    ("the-broker-socket-is-the-only-way-out", "the one allowed path"),
    (
        "the-package-registry-is-denied-at-runtime",
        "installing mid-run is running someone else code",
    ),
    (
        "an-unexpected-host-is-what-a-successful-injection-looks-like",
        "the highest-signal detection here",
    ),
    ("oversized-output-is-truncated-at-the-boundary", "it becomes prompt text"),
    ("output-exactly-at-the-cap-is-not-truncated", "the cap is inclusive"),
)


def dispatcher_would_allow(request: dict, scope: dict = None) -> bool:
    # The dispatcher's own check, written independently of the broker.
    scope = scope or SCOPE
    tool = POLICY["catalogue"].get(request["op"])
    if tool is None or tool["class"] > scope["maxClass"]:
        return False
    return (
        request["orderId"] == scope["orderId"]
        and request["amountCents"] <= scope["capCents"]
    )


class Sandboxing(unittest.TestCase):
    def setUp(self):
        self.handle = load_impl(__file__).handle

    def run_request(self, request: dict, scope: dict = None, policy: dict = None) -> dict:
        return self.handle(request, scope or SCOPE, policy or POLICY)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_request(entry["request"]), entry["result"])

    def test_a_request_for_a_secret_is_always_refused_and_alerts(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                asked = self.run_request(
                    {**entry["request"], "kind": "secret", "name": "ANY_KEY"}
                )
                self.assertEqual(
                    asked,
                    {
                        "allowed": False,
                        "reason": "no_such_capability",
                        "alerted": True,
                        "deliveredBytes": 0,
                        "truncated": False,
                    },
                )

    def test_the_broker_never_allows_what_the_dispatcher_would_refuse(self):
        for entry in FIXTURE["cases"]:
            if entry["request"]["kind"] != "op":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(
                    self.run_request(entry["request"])["allowed"],
                    dispatcher_would_allow(entry["request"]),
                )

    def test_every_tool_agrees_with_the_dispatcher_at_every_scope(self):
        for op in POLICY["catalogue"]:
            for order_id in (SCOPE["orderId"], "somewhere-else"):
                with self.subTest(f"{op}/{order_id}"):
                    request = {
                        "kind": "op",
                        "op": op,
                        "orderId": order_id,
                        "amountCents": 0,
                        "outputBytes": 10,
                    }
                    self.assertEqual(
                        self.run_request(request)["allowed"],
                        dispatcher_would_allow(request),
                    )

    def test_egress_is_allowed_exactly_for_allowlisted_hosts(self):
        for host in POLICY["egressAllow"] + ["pypi.org", "attacker.example", ""]:
            with self.subTest(host):
                result = self.run_request(
                    {"kind": "egress", "host": host, "outputBytes": 10}
                )
                self.assertEqual(result["allowed"], host in POLICY["egressAllow"])

    def test_an_empty_allowlist_denies_everything_including_the_broker(self):
        for host in POLICY["egressAllow"]:
            with self.subTest(host):
                result = self.run_request(
                    {"kind": "egress", "host": host, "outputBytes": 10},
                    policy={**POLICY, "egressAllow": []},
                )
                self.assertFalse(result["allowed"])
                self.assertTrue(result["alerted"])

    def test_egress_and_secret_denials_alert_and_authorization_denials_do_not(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_request(entry["request"])
                if result["allowed"]:
                    self.assertFalse(result["alerted"])
                    continue
                self.assertEqual(result["alerted"], entry["request"]["kind"] != "op")

    def test_a_denied_request_delivers_nothing(self):
        for entry in FIXTURE["cases"]:
            result = self.run_request(entry["request"])
            if result["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["deliveredBytes"], 0)
                self.assertFalse(result["truncated"])

    def test_nothing_ever_crosses_the_boundary_above_the_cap(self):
        cap = POLICY["maxOutputBytes"]
        for entry in FIXTURE["cases"]:
            for output_bytes in (0, 1, cap, cap + 1, 10**7):
                with self.subTest(f"{entry['id']}:{output_bytes}"):
                    result = self.run_request(
                        {**entry["request"], "outputBytes": output_bytes}
                    )
                    self.assertLessEqual(result["deliveredBytes"], cap)
                    if result["allowed"]:
                        self.assertEqual(result["truncated"], output_bytes > cap)
                        self.assertEqual(
                            result["deliveredBytes"], min(output_bytes, cap)
                        )

    def test_narrowing_the_scope_never_allows_more(self):
        narrow = {"maxClass": 0, "orderId": "nothing-matches", "capCents": 0}
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_request(entry["request"])["allowed"]
                after = self.run_request(entry["request"], scope=narrow)["allowed"]
                if entry["request"]["kind"] == "op":
                    self.assertFalse(after)
                else:
                    self.assertEqual(after, before)
