import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-trace-that-answers-all-eight-questions", "why, not just that it was wrong"),
    ("a-trace-missing-the-window-cannot-explain-the-decision", "the expensive question"),
    ("a-truncation-flag-with-no-boundary-is-warned", "a tool bug or a prompt bug"),
    (
        "a-payload-with-no-hash-neither-joins-nor-verifies",
        "the join key and the integrity check",
    ),
    ("a-run-with-no-correlation-id-joins-to-nothing", "the business entity"),
    ("an-escalation-is-always-kept", "keep the interesting"),
    ("an-outlier-is-always-kept", "the same stratification as online evals"),
    ("a-boring-run-is-usually-dropped", "sample the boring"),
    ("a-boring-run-inside-the-sample-is-kept", "a small draw of the rest"),
    ("hundreds-of-spans-blow-the-backend-budget", "an order of magnitude more"),
)


class WhatATraceMustAnswer(unittest.TestCase):
    def setUp(self):
        self.record = load_impl(__file__).record

    def go(self, entry, run=None, draw=None, policy=None):
        return self.record(
            run or entry["run"],
            policy or entry["policy"],
            entry["drawBps"] if draw is None else draw,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_question_is_required_on_its_own(self):
        entry = case(FIXTURE, "a-trace-that-answers-all-eight-questions")
        for question in entry["policy"]["questions"]:
            with self.subTest(question):
                stripped = [
                    {
                        **span,
                        "fields": {
                            k: v for k, v in span["fields"].items() if k != question
                        },
                    }
                    for span in entry["run"]["spans"]
                ]
                outcome = self.go(entry, {**entry["run"], "spans": stripped})
                self.assertEqual(outcome["status"], "incomplete")
                self.assertEqual(outcome["unanswered"], [question])

    def test_an_incomplete_trace_names_what_it_cannot_answer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                present = {
                    field
                    for span in entry["run"]["spans"]
                    for field in span["fields"]
                }
                self.assertEqual(
                    outcome["unanswered"],
                    [q for q in entry["policy"]["questions"] if q not in present],
                )
                self.assertEqual(
                    outcome["status"] == "incomplete", bool(outcome["unanswered"])
                )

    def test_anything_interesting_is_kept_regardless_of_the_draw(self):
        entry = case(FIXTURE, "a-boring-run-is-usually-dropped")
        for outcome_kind in entry["policy"]["alwaysKeep"]:
            for draw in (0, 5000, 9999):
                with self.subTest(f"{outcome_kind}/{draw}"):
                    kept = self.go(
                        entry, {**entry["run"], "outcome": outcome_kind}, draw
                    )
                    self.assertTrue(kept["sampled"])
                    self.assertEqual(kept["keptBecause"], outcome_kind)

    def test_an_outlier_is_kept_at_the_boundary(self):
        entry = case(FIXTURE, "a-boring-run-is-usually-dropped")
        limit = entry["policy"]["outlierLatencyMs"]
        for latency in (limit - 1, limit, limit + 1):
            with self.subTest(latency):
                outcome = self.go(entry, {**entry["run"], "latencyMs": latency}, 9999)
                self.assertEqual(outcome["sampled"], latency > limit)
                if latency > limit:
                    self.assertEqual(outcome["keptBecause"], "outlier")

    def test_a_boring_run_is_kept_when_the_draw_is_inside_the_rate(self):
        entry = case(FIXTURE, "a-boring-run-is-usually-dropped")
        rate = entry["policy"]["sampleBps"]
        for draw in (0, rate - 1, rate, rate + 1, 9999):
            with self.subTest(draw):
                outcome = self.go(entry, None, draw)
                self.assertEqual(outcome["sampled"], draw < rate)
                self.assertEqual(
                    outcome["keptBecause"], "sampled" if draw < rate else "dropped"
                )

    def test_sampling_never_changes_what_the_trace_can_answer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                kept = self.go(entry, None, 0)
                dropped = self.go(entry, None, 9999)
                self.assertEqual(kept["unanswered"], dropped["unanswered"])
                self.assertEqual(kept["status"], dropped["status"])

    def test_a_truncation_flag_without_a_boundary_is_warned(self):
        entry = case(FIXTURE, "a-truncation-flag-with-no-boundary-is-warned")
        outcome = self.go(entry)
        self.assertTrue(any("truncated" in w for w in outcome["warnings"]))
        bounded = [
            {**span, "fields": {**span["fields"], "truncatedAtBytes": 4000}}
            if span["fields"].get("resultTruncated") is True
            else span
            for span in entry["run"]["spans"]
        ]
        self.assertEqual(
            self.go(entry, {**entry["run"], "spans": bounded})["warnings"], []
        )

    def test_every_stored_payload_carries_a_hash(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for span in entry["run"]["spans"]:
                    owed = span["payloadBytes"] > 0 and span["contentHash"] is None
                    self.assertEqual(
                        any(
                            w.startswith(f"{span['id']} stores a payload")
                            for w in outcome["warnings"]
                        ),
                        owed,
                    )

    def test_the_backend_holds_metadata_and_the_store_holds_the_bytes(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                owed = sum(s["payloadBytes"] for s in entry["run"]["spans"])
                self.assertEqual(outcome["payloadBytes"], owed)
                self.assertEqual(
                    outcome["backendBytes"], len(entry["run"]["spans"]) * 200
                )
                if owed > 0:
                    self.assertGreater(
                        outcome["payloadBytes"], outcome["backendBytes"]
                    )

    def test_a_run_with_no_correlation_id_is_flagged(self):
        entry = case(FIXTURE, "a-run-with-no-correlation-id-joins-to-nothing")
        self.assertTrue(
            any("correlation id" in w for w in self.go(entry)["warnings"])
        )
        joined = self.go(entry, {**entry["run"], "correlationId": "ticket:8823"})
        self.assertEqual(joined["warnings"], [])
