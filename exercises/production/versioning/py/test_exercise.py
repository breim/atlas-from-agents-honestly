import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
ENVIRONMENTS = FIXTURE["environments"]

CASES = (
    ("a-run-carries-the-bundle-it-started-with", "resolved once, at the start"),
    ("a-deploy-mid-run-does-not-change-the-run", "one experiment, not two spliced"),
    (
        "policy-resolves-at-the-moment-of-each-action",
        "Friday permissions on a Monday action",
    ),
    ("an-action-exactly-at-a-boundary-uses-the-new-policy", "the boundary is inclusive"),
    ("editing-a-tool-description-is-a-new-configuration", "a description is prompt text"),
    (
        "a-later-deploy-of-the-same-bundle-is-the-same-configuration",
        "content-addressed, not git-addressed",
    ),
    (
        "a-re-index-is-a-configuration-change-with-no-code-in-it",
        "nothing in the commit moved",
    ),
    ("a-run-with-no-actions-still-records-its-configuration", "the run is the unit"),
)


def active_at(at: int, environments: list = None) -> dict:
    return [e for e in (environments or ENVIRONMENTS) if e["at"] <= at][-1]


class Versioning(unittest.TestCase):
    def setUp(self):
        self.execute = load_impl(__file__).execute

    def run_case(self, run: dict, environments: list = None) -> dict:
        return self.execute(run, environments or ENVIRONMENTS)

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry["run"]), entry["result"])

    def test_every_action_carries_the_configuration_the_run_started_with(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry["run"])
                for action in result["actions"]:
                    self.assertEqual(action["configKey"], result["configKey"])

    def test_a_deploy_after_the_run_started_never_reaches_it(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                before = self.run_case(entry["run"])
                disruptive = {
                    "at": entry["run"]["startedAt"] + 1,
                    "policyVersion": "pol-99",
                    "bundle": {
                        "systemPromptId": "sp-later",
                        "toolCatalogueHash": "tc-later",
                    },
                }
                timeline = sorted(
                    ENVIRONMENTS + [disruptive], key=lambda e: e["at"]
                )
                after = self.run_case(entry["run"], timeline)
                self.assertEqual(after["configKey"], before["configKey"])

    def test_the_policy_on_an_action_is_the_one_in_force_then(self):
        for entry in FIXTURE["cases"]:
            for action in self.run_case(entry["run"])["actions"]:
                with self.subTest(f"{entry['id']}:{action['name']}"):
                    self.assertEqual(
                        action["policy"], active_at(action["at"])["policyVersion"]
                    )

    def test_a_policy_change_does_reach_a_later_action(self):
        for entry in FIXTURE["cases"]:
            if not entry["run"]["actions"]:
                continue
            with self.subTest(entry["id"]):
                last = entry["run"]["actions"][-1]
                changed = {
                    "at": last["at"],
                    "policyVersion": "pol-tightened",
                    "bundle": active_at(last["at"])["bundle"],
                }
                timeline = sorted(ENVIRONMENTS + [changed], key=lambda e: e["at"])
                result = self.run_case(entry["run"], timeline)
                self.assertEqual(result["actions"][-1]["policy"], "pol-tightened")

    def test_the_key_depends_on_every_field_in_the_bundle(self):
        bundle = ENVIRONMENTS[0]["bundle"]
        base = self.run_case({"startedAt": 10, "actions": []}, [ENVIRONMENTS[0]])
        for field in bundle:
            with self.subTest(field):
                moved = [
                    {"at": 0, "policyVersion": "p", "bundle": {**bundle, field: "changed"}}
                ]
                self.assertNotEqual(
                    self.run_case({"startedAt": 10, "actions": []}, moved)["configKey"],
                    base["configKey"],
                )

    def test_the_key_does_not_depend_on_field_order(self):
        bundle = ENVIRONMENTS[0]["bundle"]
        reversed_bundle = dict(reversed(list(bundle.items())))
        subject = {"startedAt": 10, "actions": []}
        straight = [{"at": 0, "policyVersion": "p", "bundle": bundle}]
        shuffled = [{"at": 0, "policyVersion": "p", "bundle": reversed_bundle}]
        self.assertEqual(
            self.run_case(subject, shuffled)["configKey"],
            self.run_case(subject, straight)["configKey"],
        )

    def test_two_environments_holding_the_same_bundle_share_a_key(self):
        keys = [
            self.run_case({"startedAt": e["at"], "actions": []})["configKey"]
            for e in ENVIRONMENTS
        ]
        for index, entry in enumerate(ENVIRONMENTS):
            for position, other in enumerate(ENVIRONMENTS):
                if sorted(entry["bundle"].items()) == sorted(other["bundle"].items()):
                    with self.subTest(f"{entry['at']} vs {other['at']}"):
                        self.assertEqual(keys[index], keys[position])

    def test_one_action_out_one_action_in_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry["run"])
                self.assertEqual(
                    [(a["name"], a["at"]) for a in result["actions"]],
                    [(a["name"], a["at"]) for a in entry["run"]["actions"]],
                )

    def test_starting_later_never_picks_up_an_earlier_bundle(self):
        for entry in ENVIRONMENTS:
            with self.subTest(entry["at"]):
                at_boundary = self.run_case({"startedAt": entry["at"], "actions": []})
                just_after = self.run_case({"startedAt": entry["at"] + 1, "actions": []})
                self.assertEqual(at_boundary["configKey"], just_after["configKey"])
