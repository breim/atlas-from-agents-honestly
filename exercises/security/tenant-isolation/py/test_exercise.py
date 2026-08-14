import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("every-store-isolated-and-inventoried-is-clean", "three layers, all present"),
    ("securing-the-index-and-forgetting-the-trace-still-leaks", "the part everyone does"),
    ("a-store-nobody-inventoried-is-a-finding", "checked in CI"),
    (
        "a-key-accepted-from-the-caller-is-an-authorization-decision-delegated",
        "derive, do not accept",
    ),
    (
        "a-shared-store-scoped-outside-the-transaction-is-load-dependent",
        "the pooled connection",
    ),
    (
        "three-partial-decision-points-have-the-security-of-the-weakest",
        "one decision point or none",
    ),
    ("a-step-carrying-another-tenant-is-refused", "the run identity decides"),
    ("a-step-that-lost-its-tenant-across-a-boundary-is-refused", "survive the boundary"),
    ("a-resumption-on-another-machine-must-re-derive-the-key", "retries on other machines"),
)


class TenantIsolation(unittest.TestCase):
    def setUp(self):
        self.inspect = load_impl(__file__).inspect

    def go(self, entry, stores=None, run=None, policy=None):
        return self.inspect(
            stores or entry["stores"], run or entry["run"], policy or entry["policy"]
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_securing_one_store_secures_nothing(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for store in entry["stores"]:
            with self.subTest(store["name"]):
                weakened = [
                    s if s["name"] == store["name"] else {**s, "engineEnforced": False}
                    for s in entry["stores"]
                ]
                self.assertEqual(self.go(entry, weakened)["status"], "leaking")

    def test_every_named_store_kind_must_be_engine_enforced(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for store in entry["stores"]:
            with self.subTest(store["name"]):
                relaxed = [
                    {**s, "engineEnforced": False} if s["name"] == store["name"] else s
                    for s in entry["stores"]
                ]
                outcome = self.go(entry, relaxed)
                owed = store["kind"] in entry["policy"]["requireEngineEnforcement"]
                self.assertEqual(outcome["status"] == "leaking", owed)
                if owed:
                    self.assertTrue(
                        any(f.startswith(store["name"]) for f in outcome["findings"])
                    )

    def test_the_agent_specific_stores_are_held_to_the_same_rule(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        agent_stores = [s for s in entry["stores"] if s["kind"] != "index"]
        self.assertGreaterEqual(len(agent_stores), 5)
        for store in agent_stores:
            self.assertIn(
                store["kind"], entry["policy"]["requireEngineEnforcement"]
            )

    def test_a_key_accepted_from_the_caller_is_a_finding(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for store in entry["stores"]:
            with self.subTest(store["name"]):
                stores = [
                    {**s, "keyDerived": False} if s["name"] == store["name"] else s
                    for s in entry["stores"]
                ]
                outcome = self.go(entry, stores)
                self.assertEqual(outcome["status"], "leaking")
                self.assertTrue(
                    any("accepts its key" in f for f in outcome["findings"])
                )

    def test_a_shared_store_is_safe_only_when_scoped_to_the_transaction(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for separation in ("per-tenant", "shared"):
            for scoped in (True, False):
                with self.subTest(f"{separation}/{scoped}"):
                    stores = [
                        {**s, "separation": separation, "scopedToTransaction": scoped}
                        if s["name"] == "chunks"
                        else s
                        for s in entry["stores"]
                    ]
                    outcome = self.go(entry, stores)
                    owed = separation == "shared" and not scoped
                    self.assertEqual(
                        any("outside the transaction" in f for f in outcome["findings"]),
                        owed,
                    )

    def test_more_than_one_decision_point_is_a_finding(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for points in (0, 1, 2, 3):
            with self.subTest(points):
                outcome = self.go(
                    entry, None, None, {**entry["policy"], "decisionPoints": points}
                )
                self.assertEqual(
                    any("decision points" in f for f in outcome["findings"]), points > 1
                )

    def test_a_step_is_read_only_when_its_tenant_is_the_run_tenant(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for tenant in ("meridian", "northwind", None):
            with self.subTest(str(tenant)):
                outcome = self.go(
                    entry,
                    None,
                    {
                        **entry["run"],
                        "steps": [
                            {"store": "chunks", "tenantId": tenant, "onResume": False}
                        ],
                    },
                )
                self.assertEqual(
                    outcome["reads"][0]["allowed"], tenant == entry["run"]["tenantId"]
                )

    def test_a_resumed_step_on_another_machine_must_derive_its_key(self):
        entry = case(FIXTURE, "every-store-isolated-and-inventoried-is-clean")
        for derived in (True, False):
            for resumed in (True, False):
                with self.subTest(f"{derived}/{resumed}"):
                    stores = [
                        {**s, "keyDerived": derived} if s["name"] == "chunks" else s
                        for s in entry["stores"]
                    ]
                    run = {
                        **entry["run"],
                        "resumedOnAnotherMachine": resumed,
                        "steps": [
                            {
                                "store": "chunks",
                                "tenantId": entry["run"]["tenantId"],
                                "onResume": True,
                            }
                        ],
                    }
                    outcome = self.go(entry, stores, run)
                    self.assertEqual(
                        outcome["reads"][0]["allowed"], not (resumed and not derived)
                    )

    def test_a_leak_in_the_reads_is_a_leak(self):
        entry = case(FIXTURE, "a-step-carrying-another-tenant-is-refused")
        outcome = self.go(entry)
        self.assertEqual(outcome["findings"], [])
        self.assertEqual(outcome["status"], "leaking")

    def test_the_layer_counts_describe_the_three_layers(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["layers"]["application"], len(entry["stores"])
                )
                self.assertEqual(
                    outcome["layers"]["separation"],
                    len([s for s in entry["stores"] if s["separation"] == "per-tenant"]),
                )
                self.assertEqual(
                    outcome["layers"]["engine"],
                    len([s for s in entry["stores"] if s["engineEnforced"]]),
                )

    def test_every_store_outside_the_inventory_is_named(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    outcome["uninventoried"],
                    [s["name"] for s in entry["stores"] if not s["inInventory"]],
                )
                for name in outcome["uninventoried"]:
                    self.assertTrue(
                        any(f.startswith(name) for f in outcome["findings"])
                    )
