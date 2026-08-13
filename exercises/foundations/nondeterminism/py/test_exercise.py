import math
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("identical-samples-are-stable", "a model that never varies scores full agreement"),
    ("a-bare-majority-is-not-consensus", "three out of five is not agreement"),
    ("a-supermajority-is-stable", "exactly on the bar counts as stable"),
    ("agreement-is-rounded-not-truncated", "two thirds rounds up, it does not truncate"),
    ("a-tie-resolves-lexicographically", "a tie does not make the report random"),
    ("all-distinct-answers-have-no-consensus", "every answer different is maximum flakiness"),
    ("one-sample-agrees-with-itself", "one sample is not evidence of determinism"),
    ("no-samples-measure-nothing", "measuring nothing is not stability"),
)


class Nondeterminism(unittest.TestCase):
    def setUp(self):
        self.analyse = load_impl(__file__).analyse

    def run_case(self, entry: dict) -> dict:
        return self.analyse(entry["samples"], FIXTURE["consensusBps"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_modal_answer_is_the_most_frequent(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["modal"] is None:
                continue
            with self.subTest(entry["id"]):
                for answer in set(entry["samples"]):
                    self.assertLessEqual(entry["samples"].count(answer), result["modalCount"])

    def test_shuffling_the_samples_never_changes_the_report(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                shuffled = list(reversed(entry["samples"]))
                self.assertEqual(
                    self.analyse(shuffled, FIXTURE["consensusBps"]), self.run_case(entry)
                )

    def test_agreement_matches_the_modal_count_over_the_sample_size(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                if not entry["samples"]:
                    rate = 0
                else:
                    rate = math.floor(
                        result["modalCount"] * 10000 / len(entry["samples"]) + 0.5
                    )
                self.assertEqual(result["agreementBps"], rate)

    def test_stability_is_agreement_clearing_the_bar(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                clears = result["samples"] > 0 and result["agreementBps"] >= FIXTURE["consensusBps"]
                self.assertEqual(result["stable"], clears)
