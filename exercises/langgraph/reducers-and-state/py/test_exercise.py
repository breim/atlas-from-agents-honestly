import copy
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-last-write-channel-takes-the-newest-value", "last-write overwrites"),
    ("an-append-channel-accumulates", "append adds rather than replaces"),
    ("two-parallel-writes-to-an-append-channel-both-survive", "a superstep keeps both messages"),
    (
        "two-parallel-writes-to-a-last-channel-keep-the-newest",
        "the same concurrency, the other answer",
    ),
    ("a-max-channel-ignores-a-smaller-write", "max does not go backwards"),
    ("a-write-to-an-undeclared-channel-is-rejected", "the schema is a schema"),
    ("a-rejected-write-does-not-stop-the-others", "one bad key is not a failed superstep"),
    ("no-updates-leave-the-state-alone", "an empty superstep changes nothing"),
)


class ReducersAndState(unittest.TestCase):
    def setUp(self):
        self.reduce = load_impl(__file__).reduce

    def run_case(self, entry: dict) -> dict:
        return self.reduce(FIXTURE["state"], entry["updates"], FIXTURE["schema"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_the_input_state_is_never_mutated(self):
        snapshot = copy.deepcopy(FIXTURE["state"])
        for entry in FIXTURE["cases"]:
            self.run_case(entry)
        self.assertEqual(FIXTURE["state"], snapshot)

    def test_no_rejected_channel_appears_in_the_new_state(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                for channel in result["rejected"]:
                    self.assertNotIn(channel, result["state"])

    def test_an_untouched_channel_keeps_its_value(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                written = {u["channel"] for u in entry["updates"]}
                state = self.run_case(entry)["state"]
                for channel in FIXTURE["schema"]:
                    if channel in written:
                        continue
                    self.assertEqual(state[channel], FIXTURE["state"][channel])

    def test_an_append_channel_never_loses_a_write(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                state = self.run_case(entry)["state"]
                for update in entry["updates"]:
                    if FIXTURE["schema"].get(update["channel"]) != "append":
                        continue
                    self.assertIn(update["value"], state[update["channel"]])

    def test_a_max_channel_never_decreases(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                state = self.run_case(entry)["state"]
                for channel, reducer in FIXTURE["schema"].items():
                    if reducer == "max":
                        self.assertGreaterEqual(state[channel], FIXTURE["state"][channel])
