import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("nine-tools-a-small-graph-and-four-retrievers", "bottom-up, in order"),
    ("nineteen-tools-is-nineteen-permissions", "every tool is a permission"),
    ("issue-credit-taking-an-amount-should-derive-it", "re-derive, do not accept"),
    ("send-reply-with-a-recipient-reopens-the-exfiltration-path", "remove the parameter"),
    (
        "a-class-four-tool-with-no-paired-read-leaves-unknown-unresolvable",
        "the paired read",
    ),
    ("a-model-call-left-in-workflow-code-is-blocked", "activity code discovers"),
    ("a-decision-pushed-into-an-activity-is-blocked", "workflow code decides"),
    ("an-unsplit-corpus-lets-a-poisoned-chunk-reach-a-write", "split by trust"),
    (
        "a-workflow-id-without-the-tenant-loses-structural-tenancy",
        "one decision, two properties",
    ),
    ("a-question-with-no-retriever-for-its-kind-is-blocked", "route before retrieving"),
)


class BuildingIt(unittest.TestCase):
    def setUp(self):
        self.review = load_impl(__file__).review

    def go(self, entry, build=None, questions=None):
        return self.review(
            build or entry["build"], questions or entry["questions"], entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_the_catalogue_is_bounded(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        cap = entry["policy"]["maxTools"]
        spare = entry["build"]["tools"][0]
        for count in (cap - 1, cap, cap + 1):
            with self.subTest(count):
                tools = [{**spare, "name": f"t{i}"} for i in range(count)]
                outcome = self.go(entry, {**entry["build"], "tools": tools})
                self.assertEqual(outcome["status"] == "blocked", count > cap)

    def test_no_tool_may_take_a_derivable_argument(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        for argument in entry["policy"]["forbiddenArgs"]:
            for tool in entry["build"]["tools"]:
                with self.subTest(f"{tool['name']}/{argument}"):
                    tools = [
                        {**t, "args": t["args"] + [argument]}
                        if t["name"] == tool["name"]
                        else t
                        for t in entry["build"]["tools"]
                    ]
                    outcome = self.go(entry, {**entry["build"], "tools": tools})
                    self.assertEqual(outcome["status"], "blocked")
                    self.assertTrue(any(argument in e for e in outcome["errors"]))

    def test_every_write_above_class_three_needs_a_paired_read(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        for tool in entry["build"]["tools"]:
            with self.subTest(tool["name"]):
                tools = [
                    {**t, "pairedRead": None} if t["name"] == tool["name"] else t
                    for t in entry["build"]["tools"]
                ]
                outcome = self.go(entry, {**entry["build"], "tools": tools})
                self.assertEqual(outcome["status"] == "blocked", tool["klass"] >= 4)

    def test_every_node_sits_on_the_right_side_of_the_split(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        for node in entry["build"]["nodes"]:
            for placement in ("workflow", "activity"):
                with self.subTest(f"{node['name']}/{placement}"):
                    nodes = [
                        {**n, "placement": placement} if n["name"] == node["name"] else n
                        for n in entry["build"]["nodes"]
                    ]
                    outcome = self.go(entry, {**entry["build"], "nodes": nodes})
                    owed = (
                        placement == "workflow"
                        if node["work"] == "decide"
                        else placement == "activity"
                    )
                    self.assertEqual(outcome["status"] == "shippable", owed)

    def test_every_count_adds_up(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["activities"] + outcome["workflowNodes"],
                    len(entry["build"]["nodes"]),
                )

    def test_every_question_routes_by_its_kind(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    [r["question"] for r in outcome["routing"]],
                    [q["id"] for q in entry["questions"]],
                )
                for index, route in enumerate(outcome["routing"]):
                    self.assertEqual(
                        route["retriever"],
                        entry["policy"]["routes"].get(entry["questions"][index]["kind"]),
                    )

    def test_the_four_kinds_go_to_four_retrievers(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        retrievers = [r["retriever"] for r in self.go(entry)["routing"]]
        self.assertEqual(len(set(retrievers)), len(retrievers))
        self.assertEqual(len(retrievers), 4)

    def test_the_tenant_must_appear_in_the_workflow_id(self):
        entry = case(FIXTURE, "nine-tools-a-small-graph-and-four-retrievers")
        for workflow_id in ("atlas-meridian-8823", "atlas-8823", "meridian", ""):
            with self.subTest(workflow_id or "(empty)"):
                outcome = self.go(
                    entry, {**entry["build"], "workflowId": workflow_id}
                )
                self.assertEqual(
                    outcome["status"] == "shippable",
                    entry["build"]["tenantId"] in workflow_id,
                )

    def test_a_blocked_build_still_explains_itself(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "blocked":
                continue
            with self.subTest(entry["id"]):
                self.assertTrue(outcome["errors"])
                self.assertEqual(len(outcome["routing"]), len(entry["questions"]))
