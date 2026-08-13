import copy
import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

ISOLATIONS = (
    ("child-sees-only-allowed-keys", "the child gets the allowlist and nothing else"),
    ("a-secret-outside-the-allowlist-never-reaches-the-child", "a credential is not inherited"),
    ("an-empty-allowlist-yields-an-empty-child", "an empty allowlist is not a pass-through"),
    ("an-allowed-key-the-parent-lacks-is-simply-absent", "a missing key is absent, not None"),
)

MERGES = (
    ("merge-brings-back-only-exposed-keys", "only the exposed key comes home"),
    ("an-unexposed-key-cannot-overwrite-the-parent", "a hostile return value changes nothing"),
    ("an-exposed-key-may-overwrite-the-parent", "an exposed key is allowed to win"),
)


class SubagentIsolation(unittest.TestCase):
    def setUp(self):
        impl = load_impl(__file__)
        self.isolate = impl.isolate
        self.merge = impl.merge

    def test_isolation_matches_the_shared_fixture(self):
        for case_id, title in ISOLATIONS:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.isolate(FIXTURE["parent"], entry["allow"]), entry["child"])

    def test_merging_matches_the_shared_fixture(self):
        for case_id, title in MERGES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(
                    self.merge(FIXTURE["parent"], entry["result"], entry["expose"]),
                    entry["merged"],
                )

    def test_neither_direction_mutates_the_parent(self):
        snapshot = copy.deepcopy(FIXTURE["parent"])
        for entry in FIXTURE["cases"]:
            if entry["kind"] == "isolate":
                self.isolate(FIXTURE["parent"], entry["allow"])
            else:
                self.merge(FIXTURE["parent"], entry["result"], entry["expose"])
        self.assertEqual(FIXTURE["parent"], snapshot)

    def test_the_child_never_holds_a_key_outside_its_allowlist(self):
        for entry in FIXTURE["cases"]:
            if entry["kind"] != "isolate":
                continue
            with self.subTest(entry["id"]):
                for key in self.isolate(FIXTURE["parent"], entry["allow"]):
                    self.assertIn(key, entry["allow"])
