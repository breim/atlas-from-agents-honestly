import unittest
from math import floor

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-judge-that-agrees-with-itself-counts-every-trial", "a stable judge loses nothing"),
    ("a-flipped-trial-counts-for-nobody", "the flip is discarded, not averaged"),
    (
        "a-judge-that-always-picks-the-first-option-wins-nothing",
        "position bias, fully expressed",
    ),
    (
        "a-judge-that-always-picks-the-second-option-is-also-unusable",
        "the same failure, mirrored",
    ),
    ("an-even-split-of-consistent-wins-is-a-tie", "no candidate is ahead"),
    ("the-loser-still-takes-some-trials", "winning overall is not winning everywhere"),
    (
        "inconsistency-in-both-directions-is-still-inconsistency",
        "two biases, one problem",
    ),
    ("a-comparison-with-no-trials-decides-nothing", "no trials, no signal"),
)


def flip(pick: str) -> str:
    return "b" if pick == "a" else "a"


def relabel(trials: list) -> list:
    # Relabelling which candidate is called A also swaps which ordering is the forward one.
    return [
        {
            "id": t["id"],
            "forward": flip(t["reverse"]),
            "reverse": flip(t["forward"]),
        }
        for t in trials
    ]


class Scoring(unittest.TestCase):
    def setUp(self):
        self.compare = load_impl(__file__).compare

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.compare(entry["trials"]), entry["result"])

    def test_only_a_trial_that_agreed_with_itself_counts_toward_a_win(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compare(entry["trials"])
                agreed = sum(
                    1 for t in entry["trials"] if t["forward"] == t["reverse"]
                )
                self.assertEqual(result["a"] + result["b"], agreed)

    def test_every_trial_is_either_a_win_or_an_inconsistency(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compare(entry["trials"])
                self.assertEqual(
                    result["a"] + result["b"] + len(result["inconsistent"]),
                    len(entry["trials"]),
                )

    def test_inconsistent_names_exactly_the_trials_that_flipped(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = [
                    t["id"] for t in entry["trials"] if t["forward"] != t["reverse"]
                ]
                self.assertEqual(self.compare(entry["trials"])["inconsistent"], flipped)

    def test_every_inconsistency_is_one_direction_of_position_bias(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compare(entry["trials"])
                bias = result["positionBias"]
                self.assertEqual(
                    bias["first"] + bias["second"], len(result["inconsistent"])
                )

    def test_the_winner_is_whoever_took_more_consistent_trials(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compare(entry["trials"])
                a, b = result["a"], result["b"]
                self.assertEqual(
                    result["winner"], "tie" if a == b else ("a" if a > b else "b")
                )

    def test_consistency_is_the_share_of_trials_that_agreed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.compare(entry["trials"])
                total = len(entry["trials"])
                share = (
                    0
                    if total == 0
                    else floor((result["a"] + result["b"]) * 10000 / total + 0.5)
                )
                self.assertEqual(result["consistencyBps"], share)

    def test_which_candidate_you_call_a_does_not_change_what_the_judge_did(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.compare(entry["trials"])
                after = self.compare(relabel(entry["trials"]))
                self.assertEqual(after["a"], before["b"])
                self.assertEqual(after["b"], before["a"])
                self.assertEqual(after["inconsistent"], before["inconsistent"])
                self.assertEqual(after["positionBias"], before["positionBias"])
                self.assertEqual(after["consistencyBps"], before["consistencyBps"])
                mirrored = {"tie": "tie", "a": "b", "b": "a"}[before["winner"]]
                self.assertEqual(after["winner"], mirrored)

    def test_discarding_a_flipped_trial_never_changes_who_won(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.compare(entry["trials"])
                kept = [t for t in entry["trials"] if t["forward"] == t["reverse"]]
                after = self.compare(kept)
                self.assertEqual(after["winner"], before["winner"])
                self.assertEqual(after["a"], before["a"])
                self.assertEqual(after["b"], before["b"])
