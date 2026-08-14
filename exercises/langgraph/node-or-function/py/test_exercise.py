import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-pure-computation-is-a-plain-function", "a pure step stays a function"),
    ("a-side-effect-makes-it-a-node", "an effect must not be replayed"),
    ("needing-to-resume-after-it-makes-it-a-node", "resumption needs a boundary"),
    ("needing-its-own-trace-span-makes-it-a-node", "observability needs a span"),
    ("being-slow-alone-does-not-make-it-a-node", "slowness on its own buys nothing"),
    ("every-reason-is-reported-not-just-the-first", "all the grounds are written down"),
    ("two-reasons-are-both-reported", "two grounds are both reported"),
)

GROUNDS = ("hasSideEffect", "needsResumption", "observedSeparately")


class NodeOrFunction(unittest.TestCase):
    def setUp(self):
        self.decide = load_impl(__file__).decide

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.decide(entry["step"]), entry["result"])

    def test_slowness_never_changes_the_verdict(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = {**entry["step"], "slow": not entry["step"]["slow"]}
                self.assertEqual(self.decide(flipped), self.decide(entry["step"]))

    def test_a_node_always_has_a_reason_and_a_function_never_does(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.decide(entry["step"])
                self.assertEqual(result["verdict"] == "node", bool(result["reasons"]))

    def test_every_combination_of_grounds_is_decided_consistently(self):
        for effect in (True, False):
            for resume in (True, False):
                for observed in (True, False):
                    step = {
                        "hasSideEffect": effect,
                        "needsResumption": resume,
                        "observedSeparately": observed,
                        "slow": False,
                    }
                    with self.subTest(**step):
                        any_ground = effect or resume or observed
                        self.assertEqual(
                            self.decide(step)["verdict"],
                            "node" if any_ground else "function",
                        )

    def test_adding_a_ground_never_turns_a_node_into_a_function(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for field in GROUNDS:
                    forced = {**entry["step"], field: True}
                    self.assertEqual(self.decide(forced)["verdict"], "node")
