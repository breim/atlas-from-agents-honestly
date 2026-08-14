import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
RESULTS = {entry["component"] for entry in CONFIG["registry"].values()} | {
    CONFIG["fallback"]
}

CASES = (
    ("every-state-of-a-tool-call-is-a-frame", "a tool call is a state machine"),
    ("a-slow-call-grows-a-spinner", "the spinner earns its place after two seconds"),
    ("an-unregistered-tool-still-renders-something", "never a blank space"),
    ("an-error-is-a-state-not-a-stack-trace", "a failure is a frame too"),
    ("the-driver-approves-inline", "they are already looking at it"),
    ("someone-else-approves-from-a-queue", "the driver cannot approve their own action"),
    ("approving-shows-submitted-before-accepted", "a validator may still reject it"),
    (
        "a-rejected-approval-still-shows-its-card",
        "a rejection is an outcome, not a disappearance",
    ),
    ("the-receipt-appears-only-after-the-credit-does", "anything you show, you have said"),
    ("a-call-with-no-events-renders-nothing", "no call, no frames"),
)


class GenerativeUiAndApprovals(unittest.TestCase):
    def setUp(self):
        self.render = load_impl(__file__).render

    def run_events(self, events: list, config: dict = None) -> dict:
        return self.render(events, config or CONFIG)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_events(entry["events"]), entry["result"])

    def test_one_frame_per_event_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                frames = self.run_events(entry["events"])["frames"]
                self.assertEqual(
                    [f["state"] for f in frames],
                    [e["kind"] for e in entry["events"]],
                )

    def test_no_frame_is_ever_blank(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for frame in self.run_events(entry["events"])["frames"]:
                    self.assertTrue(frame["component"])

    def test_a_result_component_only_appears_on_the_frame_with_the_result(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for frame in self.run_events(entry["events"])["frames"]:
                    if frame["component"] not in RESULTS:
                        continue
                    self.assertEqual(frame["state"], "output_available")

    def test_every_result_gets_a_component_registered_or_not(self):
        for entry in FIXTURE["cases"]:
            frames = self.run_events(entry["events"])["frames"]
            for index, event in enumerate(entry["events"]):
                if event["kind"] != "output_available":
                    continue
                with self.subTest(f"{entry['id']}:{index}"):
                    registered = CONFIG["registry"].get(event["tool"])
                    self.assertEqual(
                        frames[index]["component"],
                        registered["component"] if registered else CONFIG["fallback"],
                    )

    def test_the_spinner_is_on_exactly_past_the_threshold(self):
        for entry in FIXTURE["cases"]:
            frames = self.run_events(entry["events"])["frames"]
            for index, event in enumerate(entry["events"]):
                with self.subTest(f"{entry['id']}:{index}"):
                    slow = event.get("elapsedMs", 0) >= CONFIG["spinnerAfterMs"]
                    self.assertEqual(frames[index]["spinner"], slow)

    def test_the_gate_goes_inline_exactly_when_the_approver_is_driving(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                gate = next(
                    (e for e in entry["events"] if e["kind"] == "gate"), None
                )
                card = self.run_events(entry["events"])["card"]
                if gate is None:
                    self.assertIsNone(card)
                    continue
                expected_placement = (
                    "inline" if gate["approver"] == CONFIG["driver"] else "queue"
                )
                self.assertEqual(card["placement"], expected_placement)

    def test_the_card_is_rendered_once_and_every_surface_shows_it(self):
        for entry in FIXTURE["cases"]:
            result = self.run_events(entry["events"])
            card = result["card"]
            if not card:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["frames"][card["frame"]]["state"], "gate")
                for frame in result["frames"]:
                    if frame["component"] != "ApprovalCard":
                        continue
                    self.assertEqual(frame["detail"], card["subject"])

    def test_an_approval_card_never_disappears_once_shown(self):
        for entry in FIXTURE["cases"]:
            result = self.run_events(entry["events"])
            card = result["card"]
            if not card:
                continue
            with self.subTest(entry["id"]):
                for frame in result["frames"][card["frame"] :]:
                    if frame["state"] == "output_available":
                        continue
                    self.assertEqual(frame["component"], "ApprovalCard")

    def test_who_is_driving_changes_the_placement_and_nothing_else(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                elsewhere = {**CONFIG, "driver": "somebody-else"}
                self.assertEqual(
                    self.run_events(entry["events"], elsewhere)["frames"],
                    self.run_events(entry["events"])["frames"],
                )
