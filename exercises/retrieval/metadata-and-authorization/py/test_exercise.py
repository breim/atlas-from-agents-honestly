import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
INDEX = FIXTURE["index"]
CONFIG = FIXTURE["config"]
PRINCIPALS = list(FIXTURE["principals"].values())
ENFORCEMENTS = ("in-query", "post")

CASES = (
    ("the-hr-document-is-never-a-candidate", "the leak that is laundered by generation"),
    ("post-filtering-reads-restricted-content-out-of-storage", "not a security boundary"),
    ("a-chunk-with-no-tenant-tag-is-invisible-not-public", "deny by default"),
    ("membership-comes-from-the-request-not-the-index", "read live, every request"),
    ("the-model-cannot-influence-the-filter", "it chooses what, not what it may"),
    (
        "late-binding-drops-a-permission-revoked-since-ingestion",
        "one extra round trip, exact",
    ),
    (
        "the-index-still-grants-what-the-source-has-revoked",
        "the window you chose to accept",
    ),
    (
        "a-principal-removed-from-every-group-retrieves-nothing",
        "revocation that actually happened",
    ),
    (
        "retrieval-without-a-principal-returns-nothing-and-says-why",
        "no path retrieves anonymously",
    ),
)


def chunk_of(chunk_id: int) -> dict:
    return next(c for c in INDEX["chunks"] if c["id"] == chunk_id)


class MetadataIsAuthorization(unittest.TestCase):
    def setUp(self):
        self.retrieve = load_impl(__file__).retrieve

    @staticmethod
    def principal_of(entry: dict):
        name = entry["principal"]
        return None if name is None else FIXTURE["principals"][name]

    @staticmethod
    def config_of(entry: dict) -> dict:
        return entry.get("config", CONFIG)

    def go(
        self,
        entry: dict,
        principal: dict = "default",
        config: dict = None,
        query: dict = None,
    ) -> dict:
        chosen = self.principal_of(entry) if principal == "default" else principal
        return self.retrieve(
            entry["query"] if query is None else query,
            chosen,
            INDEX,
            config or self.config_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_no_principal_receives_another_tenants_chunk(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    for hit in self.go(entry, principal)["results"]:
                        self.assertEqual(
                            chunk_of(hit["id"])["tenantId"], principal["tenantId"]
                        )

    def test_no_principal_receives_a_chunk_none_of_its_groups_may_read(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    for hit in self.go(entry, principal)["results"]:
                        chunk = chunk_of(hit["id"])
                        self.assertTrue(
                            any(g in principal["groups"] for g in chunk["acl"])
                        )

    def test_an_untagged_chunk_is_unreachable_by_everyone(self):
        untagged = {c["id"] for c in INDEX["chunks"] if c["tenantId"] is None}
        self.assertTrue(untagged)
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                for enforcement in ENFORCEMENTS:
                    with self.subTest(f"{entry['id']}/{principal['id']}/{enforcement}"):
                        outcome = self.go(
                            entry,
                            principal,
                            {**self.config_of(entry), "enforcement": enforcement},
                        )
                        for hit in outcome["results"]:
                            self.assertNotIn(hit["id"], untagged)

    def test_the_tenant_asked_for_in_the_query_is_never_used(self):
        entry = case(FIXTURE, "the-hr-document-is-never-a-candidate")
        tenants = {c["tenantId"] for c in INDEX["chunks"]}
        for principal in PRINCIPALS:
            honest = self.go(entry, principal)
            for tenant_id in tenants:
                with self.subTest(f"{principal['id']}/{tenant_id}"):
                    asked = self.go(
                        entry,
                        principal,
                        None,
                        {**entry["query"], "tenantId": tenant_id},
                    )
                    self.assertEqual(asked, honest)

    def test_a_superseded_chunk_is_out_of_scope_for_everyone(self):
        superseded = {
            c["id"] for c in INDEX["chunks"] if c["supersededAt"] is not None
        }
        self.assertTrue(superseded)
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    for hit in self.go(entry, principal)["results"]:
                        self.assertNotIn(hit["id"], superseded)

    def test_in_query_exposes_nothing_and_post_exposes_what_it_read(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    in_query = self.go(
                        entry,
                        principal,
                        {**self.config_of(entry), "enforcement": "in-query"},
                    )
                    self.assertEqual(in_query["exposed"], [])
                    post = self.go(
                        entry,
                        principal,
                        {**self.config_of(entry), "enforcement": "post"},
                    )
                    returned = {hit["documentId"] for hit in post["results"]}
                    for document_id in post["exposed"]:
                        self.assertNotIn(document_id, returned)

    def test_post_filtering_never_returns_more_than_in_query(self):
        entry = case(FIXTURE, "the-hr-document-is-never-a-candidate")
        saw_fewer = False
        for principal in PRINCIPALS:
            in_query = self.go(
                entry, principal, {**self.config_of(entry), "enforcement": "in-query"}
            )
            post = self.go(
                entry, principal, {**self.config_of(entry), "enforcement": "post"}
            )
            self.assertLessEqual(len(post["results"]), len(in_query["results"]))
            allowed = {hit["id"] for hit in in_query["results"]}
            for hit in post["results"]:
                self.assertIn(hit["id"], allowed)
            if len(post["results"]) < len(in_query["results"]):
                saw_fewer = True
                self.assertTrue(post["exposed"])
        self.assertTrue(saw_fewer)

    def test_late_binding_only_removes_and_names_what_it_removed(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    loose = self.go(
                        entry, principal, {**self.config_of(entry), "lateBinding": False}
                    )
                    bound = self.go(
                        entry, principal, {**self.config_of(entry), "lateBinding": True}
                    )
                    self.assertEqual(loose["revoked"], [])
                    self.assertLessEqual(len(bound["results"]), len(loose["results"]))
                    for hit in bound["results"]:
                        live = INDEX["liveAcls"].get(hit["documentId"], [])
                        self.assertTrue(any(g in principal["groups"] for g in live))

    def test_the_audit_names_the_principal_and_what_it_received(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                principal = self.principal_of(entry)
                self.assertEqual(
                    outcome["audit"]["principalId"],
                    principal["id"] if principal else None,
                )
                self.assertEqual(
                    outcome["audit"]["tenantId"],
                    principal["tenantId"] if principal else None,
                )
                self.assertEqual(
                    outcome["audit"]["retrieved"],
                    [hit["documentId"] for hit in outcome["results"]],
                )

    def test_a_request_with_no_principal_returns_and_reads_nothing(self):
        for entry in FIXTURE["cases"]:
            for enforcement in ENFORCEMENTS:
                with self.subTest(f"{entry['id']}/{enforcement}"):
                    outcome = self.go(
                        entry,
                        None,
                        {**self.config_of(entry), "enforcement": enforcement},
                    )
                    self.assertEqual(outcome["results"], [])
                    self.assertEqual(outcome["exposed"], [])
                    self.assertTrue(outcome["errors"])

    def test_nothing_is_returned_that_k_did_not_ask_for(self):
        for entry in FIXTURE["cases"]:
            for principal in PRINCIPALS:
                with self.subTest(f"{entry['id']}/{principal['id']}"):
                    outcome = self.go(entry, principal)
                    self.assertLessEqual(len(outcome["results"]), entry["query"]["k"])
                    ids = [hit["id"] for hit in outcome["results"]]
                    self.assertEqual(len(set(ids)), len(ids))
