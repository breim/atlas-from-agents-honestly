import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]

CASES = (
    ("a-clean-trace-keeps-every-span", "one owner each, nothing to reconcile"),
    (
        "a-second-library-wrapping-the-model-call-is-dropped",
        "the extra span that doubles your bill",
    ),
    (
        "a-model-span-nobody-emitted-shows-up-as-a-mismatch",
        "the ten-minute check earning its keep",
    ),
    ("content-is-not-captured-by-default", "the payloads do not belong in the backend"),
    ("turning-capture-on-keeps-the-payloads", "and it is a decision, not an accident"),
    ("an-invented-convention-key-is-a-violation", "overloading gen_ai is not portable"),
    ("the-same-fact-in-your-own-namespace-is-fine", "the identical field, correctly placed"),
    ("a-key-in-nobody-namespace-is-a-violation", "a bare key belongs to nobody"),
    ("a-dropped-span-is-not-your-problem", "discarded means not inspected"),
    ("an-empty-trace-has-nothing-to-check", "no spans, no trace"),
)


class OtelGenai(unittest.TestCase):
    def setUp(self):
        self.collect = load_impl(__file__).collect

    @staticmethod
    def config_for(entry: dict, **overrides) -> dict:
        config = dict(CONFIG)
        if "captureContent" in entry:
            config["captureContent"] = entry["captureContent"]
        config.update(overrides)
        return config

    def run_case(self, entry: dict, **overrides) -> dict:
        return self.collect(
            entry["spans"], self.config_for(entry, **overrides), entry["providerTokens"]
        )

    @staticmethod
    def owned(entry: dict) -> list:
        return [
            s for s in entry["spans"] if s["emitter"] == CONFIG["owners"].get(s["type"])
        ]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_span_is_either_kept_or_dropped_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                self.assertEqual(
                    sorted(result["kept"] + result["dropped"]),
                    sorted(span["id"] for span in entry["spans"]),
                )

    def test_a_span_is_kept_exactly_when_its_emitter_owns_the_type(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.run_case(entry)["kept"]
                for span in entry["spans"]:
                    owns = span["emitter"] == CONFIG["owners"].get(span["type"])
                    self.assertEqual(span["id"] in kept, owns)

    def test_tokens_are_summed_over_kept_spans_only(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                total = sum(
                    span["attributes"].get("gen_ai.usage.input_tokens", 0)
                    + span["attributes"].get("gen_ai.usage.output_tokens", 0)
                    for span in self.owned(entry)
                )
                self.assertEqual(self.run_case(entry)["tokens"], total)

    @staticmethod
    def usage(span: dict) -> int:
        attributes = span["attributes"]
        return attributes.get("gen_ai.usage.input_tokens", 0) + attributes.get(
            "gen_ai.usage.output_tokens", 0
        )

    def test_keeping_the_duplicates_would_have_broken_the_provider_check(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry)
                naive = sum(self.usage(span) for span in entry["spans"])
                doubled = sum(
                    self.usage(span)
                    for span in entry["spans"]
                    if span["id"] in before["dropped"]
                )
                self.assertEqual(naive, before["tokens"] + doubled)
                if doubled == 0 or not before["tokensMatchProvider"]:
                    continue
                self.assertNotEqual(naive, entry["providerTokens"])

    def test_a_violation_only_ever_names_a_span_that_was_kept(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for violation in result["violations"]:
                    self.assertIn(violation.split(":")[0], result["kept"])

    def test_a_key_is_a_violation_exactly_when_it_is_neither_convention_nor_yours(self):
        for entry in FIXTURE["cases"]:
            violations = self.run_case(entry)["violations"]
            for span in self.owned(entry):
                for key in span["attributes"]:
                    with self.subTest(f"{entry['id']}:{span['id']}:{key}"):
                        conventional = (
                            key.startswith("gen_ai.") and key in CONFIG["conventionKeys"]
                        )
                        ours = key.startswith(CONFIG["namespace"] + ".")
                        flagged = any(
                            v.startswith(span["id"] + ":") and v.endswith(":" + key)
                            for v in violations
                        )
                        self.assertEqual(flagged, not conventional and not ours)

    def test_moving_a_rejected_key_into_your_namespace_clears_it(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["violations"]:
                continue
            with self.subTest(entry["id"]):
                renamed = [
                    {
                        **span,
                        "attributes": {
                            (
                                key
                                if key in CONFIG["conventionKeys"]
                                else f"{CONFIG['namespace']}.{key}"
                            ): value
                            for key, value in span["attributes"].items()
                        },
                    }
                    for span in entry["spans"]
                ]
                result = self.collect(
                    renamed, self.config_for(entry), entry["providerTokens"]
                )
                self.assertEqual(result["violations"], [])

    def test_a_span_is_redacted_exactly_when_it_carries_content_and_capture_is_off(self):
        for entry in FIXTURE["cases"]:
            for capture in (False, True):
                redacted = self.run_case(entry, captureContent=capture)["redacted"]
                for span in self.owned(entry):
                    with self.subTest(f"{entry['id']}:{capture}:{span['id']}"):
                        carries = any(
                            key in CONFIG["contentKeys"] for key in span["attributes"]
                        )
                        self.assertEqual(
                            span["id"] in redacted, carries and not capture
                        )

    def test_capturing_content_changes_nothing_about_tokens_or_violations(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                off = self.run_case(entry, captureContent=False)
                on = self.run_case(entry, captureContent=True)
                self.assertEqual(on["tokens"], off["tokens"])
                self.assertEqual(on["violations"], off["violations"])
                self.assertEqual(on["kept"], off["kept"])
