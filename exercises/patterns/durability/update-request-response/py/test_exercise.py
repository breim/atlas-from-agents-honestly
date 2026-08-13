import copy
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-accepted-update-mutates-and-answers", "a valid update changes state and returns"),
    ("a-rejected-update-leaves-the-state-untouched", "validation happens before mutation"),
    ("an-unknown-update-is-rejected-not-applied", "an unrecognised kind changes nothing"),
    ("a-rejection-does-not-stop-the-next-update", "the caller can correct and retry"),
    ("accepted-updates-accumulate", "successive updates compound"),
    ("closing-is-an-update-too", "a lifecycle change is just another update"),
    ("a-closed-workflow-refuses-further-credit", "the check runs before the credit is added"),
    ("no-updates-leave-the-workflow-as-it-started", "no updates is no change"),
)


class UpdateRequestResponse(unittest.TestCase):
    def setUp(self):
        self.apply_updates = load_impl(__file__).apply_updates

    def run_case(self, entry: dict) -> dict:
        return self.apply_updates(FIXTURE["initial"], entry["updates"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_initial_state_is_never_mutated(self):
        snapshot = copy.deepcopy(FIXTURE["initial"])
        for entry in FIXTURE["cases"]:
            self.run_case(entry)
        self.assertEqual(FIXTURE["initial"], snapshot)

    def test_one_response_per_update(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(len(self.run_case(entry)["responses"]), len(entry["updates"]))

    def test_a_run_of_only_rejections_changes_nothing(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if any(response["ok"] for response in result["responses"]):
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["state"], FIXTURE["initial"])

    def test_credit_never_decreases_and_never_goes_negative(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                state = self.run_case(entry)["state"]
                self.assertGreaterEqual(state["creditCents"], FIXTURE["initial"]["creditCents"])
                self.assertGreaterEqual(state["creditCents"], 0)
