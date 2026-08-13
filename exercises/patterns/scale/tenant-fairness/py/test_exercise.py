import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("one-tenant-keeps-its-own-order", "a single tenant is plain FIFO"),
    ("two-tenants-alternate", "turns alternate between tenants"),
    ("a-noisy-tenant-cannot-starve-a-quiet-one", "a bulk import does not bury one request"),
    ("turn-order-follows-first-appearance", "the first tenant to ask is the first served"),
    ("an-exhausted-tenant-is-skipped", "fairness does not idle a worker"),
    ("three-tenants-cycle", "the rotation extends to any number of tenants"),
    ("an-empty-queue-schedules-nothing", "nothing queued is nothing scheduled"),
)


class TenantFairness(unittest.TestCase):
    def setUp(self):
        self.schedule = load_impl(__file__).schedule

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.schedule(entry["queue"]), entry["order"])

    def test_every_task_is_scheduled_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    sorted(self.schedule(entry["queue"])),
                    sorted(item["task"] for item in entry["queue"]),
                )

    def test_each_tenant_keeps_its_own_submission_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                order = self.schedule(entry["queue"])
                for tenant in {item["tenant"] for item in entry["queue"]}:
                    submitted = [i["task"] for i in entry["queue"] if i["tenant"] == tenant]
                    self.assertEqual([t for t in order if t in submitted], submitted)

    def test_a_round_serves_every_tenant_before_anyone_goes_twice(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                owner = {item["task"]: item["tenant"] for item in entry["queue"]}
                remaining: dict = {}
                for item in entry["queue"]:
                    remaining[item["tenant"]] = remaining.get(item["tenant"], 0) + 1

                at_round_start = dict(remaining)
                served: set = set()

                for task in self.schedule(entry["queue"]):
                    tenant = owner[task]

                    # A repeat means a new round began; the previous one owed everyone a turn.
                    if tenant in served:
                        skipped = [
                            name
                            for name, left in at_round_start.items()
                            if left > 0 and name not in served
                        ]
                        self.assertEqual(skipped, [])
                        served = set()
                        at_round_start = dict(remaining)

                    served.add(tenant)
                    remaining[tenant] -= 1
