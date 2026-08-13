import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-railed-request-never-reaches-the-model", "a known question costs nothing"),
    ("the-first-matching-rail-answers", "the matching rail supplies the answer"),
    ("an-unrailed-request-falls-through-to-the-model", "an unknown question reaches the model"),
    ("a-request-with-no-intent-falls-through", "a missing intent is not a rail match"),
    ("a-rail-answers-identically-every-time", "a railed answer cannot drift"),
    ("an-intent-that-only-looks-railed-falls-through", "matching is exact, not by prefix"),
)


class Spy:
    """Counts real invocations, so a discarded model call is still a model call."""

    def __init__(self):
        self.calls = 0

    def __call__(self, request: dict) -> str:
        self.calls += 1
        return f"model answer for {request.get('intent', 'unknown')}"


class DeterministicRails(unittest.TestCase):
    def setUp(self):
        self.handle = load_impl(__file__).handle

    def run_case(self, entry: dict):
        spy = Spy()
        return self.handle(entry["request"], FIXTURE["rails"], spy), spy.calls

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                handled, _ = self.run_case(entry)
                self.assertEqual(handled, entry["result"])

    def test_a_railed_answer_really_does_not_invoke_the_model(self):
        for entry in FIXTURE["cases"]:
            handled, calls = self.run_case(entry)
            if handled["source"] != "rail":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(calls, 0)

    def test_the_reported_count_matches_what_happened(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                handled, calls = self.run_case(entry)
                self.assertEqual(handled["modelCalls"], calls)

    def test_a_railed_answer_comes_verbatim_from_its_rail(self):
        for entry in FIXTURE["cases"]:
            handled, _ = self.run_case(entry)
            if handled["source"] != "rail":
                continue
            with self.subTest(entry["id"]):
                rail = next(r for r in FIXTURE["rails"] if r["when"] == entry["request"]["intent"])
                self.assertEqual(handled["answer"], rail["answer"])
