import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
CATALOGUE = FIXTURE["catalogue"]

CASES = (
    ("a-read-on-a-clean-run-is-admitted", "nothing untrusted has arrived"),
    ("reading-a-ticket-body-taints-the-run", "because of where the bytes came from"),
    ("a-scoped-credit-on-a-tainted-run-is-admitted", "this ticket, this order, tier zero"),
    (
        "the-same-tool-pointed-at-another-account-is-not",
        "ticket #9104, stopped at the dispatcher",
    ),
    (
        "the-right-order-for-the-wrong-amount-is-not-scoped",
        "blast radius lives in the arguments",
    ),
    ("all-three-present-and-the-path-is-still-safe", "the vector was narrowed, not removed"),
    ("a-model-authored-recipient-is-refused", "this is where the trifecta breaks"),
    (
        "an-untainted-run-still-cannot-invent-a-recipient",
        "a control, not a response to taint",
    ),
    ("a-later-trusted-read-does-not-clear-the-taint", "there is no un-taint path"),
    ("a-path-with-nothing-private-is-not-lethal", "two of three is survivable"),
)


class PromptInjection(unittest.TestCase):
    def setUp(self):
        self.assess = load_impl(__file__).assess

    def run_path(self, path: dict) -> dict:
        return self.assess(path, CATALOGUE, CONFIG)

    @staticmethod
    def tool_of(path: dict) -> dict:
        return CATALOGUE[path["call"]["tool"]]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_path(entry["path"]), entry["result"])

    def test_taint_is_exactly_whether_any_read_was_untrusted(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                untrusted = [
                    r for r in entry["path"]["reads"] if r["trust"] == "untrusted"
                ]
                result = self.run_path(entry["path"])
                self.assertEqual(result["tainted"], bool(untrusted))
                self.assertEqual(
                    result["sources"], [r["source"] for r in untrusted]
                )

    def test_appending_any_read_never_clears_the_taint(self):
        for entry in FIXTURE["cases"]:
            before = self.run_path(entry["path"])
            if not before["tainted"]:
                continue
            for trust in ("trusted", "untrusted"):
                with self.subTest(f"{entry['id']}/{trust}"):
                    later = {"source": "later-read", "trust": trust, "private": False}
                    after = self.run_path(
                        {**entry["path"], "reads": entry["path"]["reads"] + [later]}
                    )
                    self.assertTrue(after["tainted"])
                    self.assertEqual(
                        after["sources"][: len(before["sources"])], before["sources"]
                    )

    def test_an_innocent_untrusted_read_taints_identically(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                renamed = [
                    {**r, "source": f"{r['source']}-benign"}
                    for r in entry["path"]["reads"]
                ]
                after = self.run_path({**entry["path"], "reads": renamed})
                before = self.run_path(entry["path"])
                self.assertEqual(after["tainted"], before["tainted"])
                self.assertEqual(after["admitted"], before["admitted"])

    def test_lethal_is_exactly_all_three_legs(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_path(entry["path"])
                trifecta = result["trifecta"]
                self.assertEqual(result["lethal"], all(trifecta.values()))
                self.assertEqual(
                    trifecta["exfiltration"], self.tool_of(entry["path"])["exfiltrates"]
                )
                self.assertEqual(
                    trifecta["privateData"],
                    any(r["private"] for r in entry["path"]["reads"]),
                )

    def test_being_lethal_is_never_a_denial_on_its_own(self):
        for entry in FIXTURE["cases"]:
            result = self.run_path(entry["path"])
            if not result["lethal"] or not result["admitted"]:
                continue
            with self.subTest(entry["id"]):
                self.assertIsNone(result["reason"])

    def test_an_exfiltrating_call_is_refused_off_the_record(self):
        for entry in FIXTURE["cases"]:
            if not self.tool_of(entry["path"])["exfiltrates"]:
                continue
            with self.subTest(entry["id"]):
                forged = {
                    **entry["path"],
                    "call": {
                        **entry["path"]["call"],
                        "recipient": "somewhere@else.example",
                    },
                }
                result = self.run_path(forged)
                self.assertFalse(result["admitted"])
                self.assertEqual(result["reason"], "recipient_not_from_record")

    def test_a_tainted_run_below_the_ceiling_is_admitted(self):
        for entry in FIXTURE["cases"]:
            for name, tool in CATALOGUE.items():
                if tool["class"] > CONFIG["maxClassWhenTainted"] or tool["exfiltrates"]:
                    continue
                with self.subTest(f"{entry['id']}:{name}"):
                    low = {
                        **entry["path"],
                        "call": {
                            **entry["path"]["call"],
                            "tool": name,
                            "orderId": "anything",
                            "amountCents": 9_999_999,
                        },
                    }
                    self.assertTrue(self.run_path(low)["admitted"])

    def test_above_the_ceiling_a_tainted_run_needs_scope_and_cap(self):
        for entry in FIXTURE["cases"]:
            result = self.run_path(entry["path"])
            tool = self.tool_of(entry["path"])
            if (
                not result["tainted"]
                or tool["class"] <= CONFIG["maxClassWhenTainted"]
                or tool["exfiltrates"]
            ):
                continue
            for call in (
                {"orderId": "somewhere-else", "amountCents": 1},
                {
                    "orderId": entry["path"]["ticket"]["orderId"],
                    "amountCents": CONFIG["tier0CapCents"] + 1,
                },
            ):
                with self.subTest(f"{entry['id']}:{call}"):
                    wide = self.run_path(
                        {**entry["path"], "call": {**entry["path"]["call"], **call}}
                    )
                    self.assertFalse(wide["admitted"])
                    self.assertEqual(wide["reason"], "class_above_taint_ceiling")

    def test_a_denial_always_escalates_and_carries_its_sources(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_path(entry["path"])
                self.assertEqual(result["escalate"], not result["admitted"])
                self.assertEqual(result["reason"] is None, result["admitted"])
                if not result["admitted"] and result["tainted"]:
                    self.assertTrue(result["sources"])

    def test_an_untainted_run_is_never_refused_for_reading(self):
        for entry in FIXTURE["cases"]:
            path = entry["path"]
            if (
                self.tool_of(path)["exfiltrates"]
                and path["call"]["recipient"] != path["ticket"]["customerEmail"]
            ):
                continue
            with self.subTest(entry["id"]):
                clean = [{**r, "trust": "trusted"} for r in path["reads"]]
                self.assertTrue(self.run_path({**path, "reads": clean})["admitted"])
