import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("the-api-derives-the-workflow-id-from-the-business-identity", "the requester rule"),
    ("starting-work-returns-immediately", "never hold the request open"),
    ("a-signal-returns-immediately-too", "four verbs"),
    ("a-cold-load-opens-the-stream-before-it-snapshots", "stream-first"),
    ("a-list-comes-from-the-read-model-not-the-cluster", "the cluster is not a database"),
    ("a-workflow-id-from-the-browser-is-refused", "broken object-level authorization"),
    ("an-unentitled-business-id-is-not-found-rather-than-forbidden", "404, not 403"),
    ("an-anonymous-request-is-not-found", "no principal, no record"),
    ("a-request-held-open-is-refused", "the API is not the worker"),
    ("starting-work-on-a-get-is-refused", "a GET starts nothing"),
    ("credentials-in-a-buffered-stream-are-refused", "a buffer everyone replays"),
    ("a-polled-query-is-refused", "load that scales with tabs"),
)


class UiToDurableBackend(unittest.TestCase):
    def setUp(self):
        self.serve = load_impl(__file__).serve

    def go(self, entry, request=None):
        return self.serve(
            request or entry["request"], entry["entitlements"], entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_the_workflow_id_is_always_derived(self):
        entry = case(FIXTURE, "the-api-derives-the-workflow-id-from-the-business-identity")
        derived = self.go(entry)["workflowId"]
        self.assertIn(entry["request"]["businessId"], derived)
        for supplied in ("atlas-ticket-9100", "atlas-ticket-8823", "anything"):
            with self.subTest(supplied):
                outcome = self.go(
                    entry, {**entry["request"], "workflowIdFromBrowser": supplied}
                )
                self.assertEqual(outcome["status"], 500)
                self.assertIsNone(outcome["workflowId"])

    def test_an_entitlement_failure_looks_like_a_missing_record(self):
        entry = case(FIXTURE, "the-api-derives-the-workflow-id-from-the-business-identity")
        unentitled = self.go(entry, {**entry["request"], "businessId": "ticket-9100"})
        missing = self.go(entry, {**entry["request"], "businessId": "ticket-0000"})
        self.assertEqual(unentitled["status"], 404)
        self.assertEqual(unentitled, missing)

    def test_every_principal_sees_only_what_it_is_entitled_to(self):
        entry = case(FIXTURE, "the-api-derives-the-workflow-id-from-the-business-identity")
        entitled = entry["entitlements"]["entitled"]
        everything = sorted({b for ids in entitled.values() for b in ids})
        for principal in entitled:
            for business_id in everything:
                with self.subTest(f"{principal}/{business_id}"):
                    outcome = self.go(
                        entry,
                        {**entry["request"], "principal": principal, "businessId": business_id},
                    )
                    self.assertEqual(
                        outcome["status"] == 200, business_id in entitled[principal]
                    )

    def test_nothing_is_ever_refused_with_a_403(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertNotEqual(self.go(entry)["status"], 403)

    def test_a_refused_request_derives_nothing(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] in (200, 202):
                continue
            with self.subTest(entry["id"]):
                self.assertIsNone(outcome["workflowId"])
                self.assertIsNone(outcome["source"])
                self.assertEqual(outcome["order"], [])

    def test_start_and_signal_return_immediately(self):
        entry = case(FIXTURE, "starting-work-returns-immediately")
        for verb in ("start", "signal"):
            with self.subTest(verb):
                outcome = self.go(
                    entry, {**entry["request"], "verb": verb, "method": "POST"}
                )
                self.assertEqual(outcome["status"], 202)
                self.assertEqual(outcome["order"], [verb])

    def test_a_cold_load_opens_the_stream_before_snapshotting(self):
        entry = case(FIXTURE, "a-cold-load-opens-the-stream-before-it-snapshots")
        order = self.go(entry)["order"]
        self.assertEqual(order[0], "open-stream")
        self.assertLess(order.index("snapshot"), order.index("render"))
        self.assertEqual(order[-1], "reconcile")

    def test_a_list_never_touches_the_cluster(self):
        entry = case(FIXTURE, "a-list-comes-from-the-read-model-not-the-cluster")
        listing = self.go(entry)
        self.assertEqual(listing["source"], "read-model")
        self.assertIsNone(listing["workflowId"])
        detail = self.go(entry, {**entry["request"], "verb": "query"})
        self.assertEqual(detail["source"], "workflow")

    def test_polling_is_refused_for_a_query(self):
        entry = case(FIXTURE, "the-api-derives-the-workflow-id-from-the-business-identity")
        for verb in ("query", "reconnect", "list"):
            with self.subTest(verb):
                outcome = self.go(
                    entry, {**entry["request"], "verb": verb, "polling": True}
                )
                self.assertEqual(outcome["status"] == 500, verb == "query")

    def test_the_four_forbidden_behaviours_are_each_refused(self):
        entry = case(FIXTURE, "the-api-derives-the-workflow-id-from-the-business-identity")
        probes = {
            "a supplied workflow id": {"workflowIdFromBrowser": "atlas-x"},
            "a held-open request": {"holdsRequestOpen": True},
            "work started on a GET": {"verb": "start", "method": "GET"},
            "credentials in the stream": {"credentialsInStream": True},
        }
        for name, patch in probes.items():
            with self.subTest(name):
                outcome = self.go(entry, {**entry["request"], **patch})
                self.assertEqual(outcome["status"], 500)
                self.assertTrue(outcome["errors"])

    def test_a_start_on_post_is_fine_and_on_get_is_not(self):
        entry = case(FIXTURE, "starting-work-returns-immediately")
        self.assertEqual(
            self.go(entry, {**entry["request"], "verb": "start", "method": "POST"})["status"],
            202,
        )
        self.assertEqual(
            self.go(entry, {**entry["request"], "verb": "start", "method": "GET"})["status"],
            500,
        )
        self.assertEqual(
            self.go(entry, {**entry["request"], "verb": "query", "method": "GET"})["status"],
            200,
        )
