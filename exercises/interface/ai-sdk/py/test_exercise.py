import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("one-loop-where-durability-lives-is-sound", "one loop, one owner"),
    ("cost-and-deadline-are-still-yours", "two conditions ship, two do not"),
    ("bounding-cost-and-deadline-yourself-silences-the-warning", "you can still own them"),
    ("three-loops-are-three-step-counters-that-disagree", "adopting all three"),
    ("the-loop-must-live-where-durability-lives", "neither framework loop"),
    ("a-loop-with-no-stop-condition-runs-forever", "now an API parameter"),
    ("a-loop-with-no-step-cap-is-unsound", "the bound is not optional"),
    ("a-chat-cap-on-a-one-call-shape-is-warned", "one for one-tool-then-answer"),
    ("an-autonomous-shape-affords-a-larger-cap", "ten to twenty"),
    ("python-cannot-host-the-interface-layer", "typescript-only"),
    ("the-deprecated-object-api-is-warned-not-refused", "slated for removal"),
)


class AiSdk(unittest.TestCase):
    def setUp(self):
        self.place = load_impl(__file__).place

    def go(self, entry, runtime=None, shape=None):
        return self.place(
            runtime or entry["runtime"], shape or entry["shape"], entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_exactly_one_loop_is_sound(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        one = entry["runtime"]["loops"][0]
        for count in (0, 1, 2, 3):
            with self.subTest(count):
                outcome = self.go(entry, {**entry["runtime"], "loops": [one] * count})
                self.assertEqual(outcome["status"] == "sound", count == 1)
                self.assertEqual(
                    outcome["loopOwner"], one["owner"] if count == 1 else None
                )

    def test_the_loop_must_live_where_durability_lives(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        owners = ("ai-sdk", "langgraph", "workflow")
        for durability in owners:
            for owner in owners:
                with self.subTest(f"{owner}/{durability}"):
                    outcome = self.go(
                        entry,
                        {
                            **entry["runtime"],
                            "durabilityLives": durability,
                            "loops": [{**entry["runtime"]["loops"][0], "owner": owner}],
                        },
                    )
                    self.assertEqual(outcome["status"] == "sound", owner == durability)

    def test_with_no_durable_backend_any_owner_is_acceptable(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        for owner in ("ai-sdk", "langgraph", "workflow"):
            with self.subTest(owner):
                outcome = self.go(
                    entry,
                    {
                        **entry["runtime"],
                        "durabilityLives": "none",
                        "loops": [{**entry["runtime"]["loops"][0], "owner": owner}],
                    },
                )
                self.assertEqual(outcome["status"], "sound")

    def test_a_loop_with_no_stop_condition_or_cap_is_unsound(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        bare = self.go(
            entry,
            {
                **entry["runtime"],
                "loops": [{**entry["runtime"]["loops"][0], "stopConditions": []}],
            },
        )
        self.assertEqual(bare["status"], "unsound")
        uncapped = self.go(
            entry,
            {
                **entry["runtime"],
                "loops": [{**entry["runtime"]["loops"][0], "maxSteps": None}],
            },
        )
        self.assertEqual(uncapped["status"], "unsound")

    def test_only_first_party_conditions_are_counted_as_owned(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for condition in outcome["boundsOwned"]:
                    self.assertIn(
                        condition, entry["policy"]["firstPartyStopConditions"]
                    )
                self.assertEqual(
                    outcome["boundsYours"], sorted(entry["policy"]["boundsYouOwn"])
                )

    def test_cost_and_deadline_warn_unless_you_bound_them(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        for bound in entry["policy"]["boundsYouOwn"]:
            with self.subTest(bound):
                without = self.go(entry)
                self.assertTrue(any(w.startswith(bound) for w in without["warnings"]))
                loop = entry["runtime"]["loops"][0]
                with_bound = self.go(
                    entry,
                    {
                        **entry["runtime"],
                        "loops": [
                            {**loop, "stopConditions": loop["stopConditions"] + [bound]}
                        ],
                    },
                )
                self.assertFalse(
                    any(w.startswith(bound) for w in with_bound["warnings"])
                )

    def test_a_step_cap_does_not_stand_in_for_cost_or_deadline(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        outcome = self.go(
            entry,
            {
                **entry["runtime"],
                "loops": [
                    {
                        **entry["runtime"]["loops"][0],
                        "stopConditions": ["step-count"],
                        "maxSteps": 1,
                    }
                ],
            },
        )
        self.assertEqual(
            len([w for w in outcome["warnings"] if "nothing here bounds it" in w]), 2
        )

    def test_the_step_cap_is_judged_against_the_shape(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        for shape in entry["policy"]["shapes"]:
            for steps in (shape["suggestedMaxSteps"], shape["suggestedMaxSteps"] + 1):
                with self.subTest(f"{shape['name']}/{steps}"):
                    outcome = self.go(
                        entry,
                        {
                            **entry["runtime"],
                            "loops": [
                                {**entry["runtime"]["loops"][0], "maxSteps": steps}
                            ],
                        },
                        shape["name"],
                    )
                    self.assertEqual(
                        any(f"{steps} steps" in w for w in outcome["warnings"]),
                        steps > shape["suggestedMaxSteps"],
                    )

    def test_an_unsound_runtime_names_no_loop_owner(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["loopOwner"] is None, outcome["status"] == "unsound"
                )

    def test_python_is_refused_for_the_interface_layer(self):
        entry = case(FIXTURE, "one-loop-where-durability-lives-is-sound")
        for language in ("typescript", "python"):
            with self.subTest(language):
                outcome = self.go(entry, {**entry["runtime"], "language": language})
                self.assertEqual(outcome["status"] == "unsound", language == "python")

    def test_the_deprecated_object_api_warns_without_failing(self):
        entry = case(FIXTURE, "the-deprecated-object-api-is-warned-not-refused")
        outcome = self.go(entry)
        self.assertEqual(outcome["status"], "sound")
        self.assertTrue(any("deprecated" in w for w in outcome["warnings"]))
        modern = self.go(entry, {**entry["runtime"], "usesDeprecatedObjectApi": False})
        self.assertFalse(any("deprecated" in w for w in modern["warnings"]))
