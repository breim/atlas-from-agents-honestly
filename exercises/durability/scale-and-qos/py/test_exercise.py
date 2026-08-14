import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("one-tenant-at-one-priority-is-plain-fifo", "nothing to schedule around"),
    ("live-chat-drains-before-the-normal-queue", "a customer waiting is priority 1"),
    ("every-priority-level-drains-in-order", "five levels, strictly"),
    ("two-tenants-alternate-within-a-priority", "each key gets a turn"),
    (
        "a-bulk-import-cannot-starve-a-quiet-tenant",
        "the noisy neighbour, removed in one line",
    ),
    (
        "an-enterprise-weight-takes-two-turns-to-a-standard-one",
        "weight buys share, not precedence",
    ),
    (
        "priority-outranks-fairness",
        "priority picks the sub-queue; fairness orders within it",
    ),
    ("a-tenant-without-a-declared-weight-takes-one-turn", "the default share is one"),
    ("turn-order-follows-first-appearance", "the rotation starts where the queue did"),
    ("an-empty-queue-dispatches-nothing", "no work, no order"),
)


class ScaleAndQos(unittest.TestCase):
    def setUp(self):
        self.dispatch = load_impl(__file__).dispatch

    def run_case(self, entry: dict) -> list:
        return self.dispatch(entry["tasks"], FIXTURE["weights"])

    @staticmethod
    def weight_of(tenant: str) -> int:
        return FIXTURE["weights"].get(tenant, 1)

    @staticmethod
    def levels(entry: dict) -> list:
        return sorted({task["priority"] for task in entry["tasks"]})

    @staticmethod
    def at(entry: dict, priority: int) -> list:
        return [t for t in entry["tasks"] if t["priority"] == priority]

    def dispatched_at(self, entry: dict, priority: int) -> list:
        ids = {task["id"] for task in self.at(entry, priority)}
        return [task_id for task_id in self.run_case(entry) if task_id in ids]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_task_is_dispatched_exactly_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertEqual(
                    sorted(self.run_case(entry)),
                    sorted(task["id"] for task in entry["tasks"]),
                )

    def test_a_higher_priority_always_goes_before_a_lower_one(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                order = self.run_case(entry)
                priority = {t["id"]: t["priority"] for t in entry["tasks"]}
                for first, second in zip(order, order[1:]):
                    self.assertLessEqual(priority[first], priority[second])

    def test_within_one_priority_a_tenant_keeps_its_submission_order(self):
        for entry in FIXTURE["cases"]:
            for priority in self.levels(entry):
                level = self.at(entry, priority)
                order = self.dispatched_at(entry, priority)
                for tenant in {task["tenant"] for task in level}:
                    with self.subTest(f"{entry['id']}:{priority}:{tenant}"):
                        submitted = [t["id"] for t in level if t["tenant"] == tenant]
                        self.assertEqual(
                            [i for i in order if i in submitted], submitted
                        )

    def test_no_tenant_waits_behind_more_than_one_weighted_round(self):
        for entry in FIXTURE["cases"]:
            for priority in self.levels(entry):
                level = self.at(entry, priority)
                tenant_of = {task["id"]: task["tenant"] for task in level}
                turns = list(dict.fromkeys(task["tenant"] for task in level))
                order = self.dispatched_at(entry, priority)
                for position, tenant in enumerate(turns):
                    with self.subTest(f"{entry['id']}:{priority}:{tenant}"):
                        ahead = sum(self.weight_of(o) for o in turns[:position])
                        first = next(
                            i
                            for i, task_id in enumerate(order)
                            if tenant_of[task_id] == tenant
                        )
                        self.assertLessEqual(first, ahead)

    def test_the_first_round_of_a_level_hands_each_tenant_its_weight(self):
        for entry in FIXTURE["cases"]:
            for priority in self.levels(entry):
                level = self.at(entry, priority)
                tenant_of = {task["id"]: task["tenant"] for task in level}
                turns = list(dict.fromkeys(task["tenant"] for task in level))
                size = sum(self.weight_of(tenant) for tenant in turns)
                first_round = self.dispatched_at(entry, priority)[:size]
                for tenant in turns:
                    backlog = sum(1 for t in level if t["tenant"] == tenant)
                    if backlog < self.weight_of(tenant):
                        continue
                    with self.subTest(f"{entry['id']}:{priority}:{tenant}"):
                        served = sum(1 for i in first_round if tenant_of[i] == tenant)
                        self.assertEqual(served, self.weight_of(tenant))

    def test_an_explicit_weight_of_one_is_the_same_as_no_weight(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                declared = dict(FIXTURE["weights"])
                for task in entry["tasks"]:
                    declared.setdefault(task["tenant"], 1)
                self.assertEqual(
                    self.dispatch(entry["tasks"], declared), self.run_case(entry)
                )

    def test_deepening_one_backlog_never_delays_another_tenant(self):
        for entry in FIXTURE["cases"]:
            if not entry["tasks"]:
                continue
            noisy = entry["tasks"][0]
            extra = [
                {**noisy, "id": f"{noisy['id']}-extra-{index}"} for index in range(5)
            ]
            flooded = self.dispatch(entry["tasks"] + extra, FIXTURE["weights"])
            before = self.run_case(entry)
            for tenant in {task["tenant"] for task in entry["tasks"]}:
                if tenant == noisy["tenant"]:
                    continue
                with self.subTest(f"{entry['id']}:{tenant}"):
                    first = next(
                        t["id"] for t in entry["tasks"] if t["tenant"] == tenant
                    )
                    self.assertLessEqual(
                        flooded.index(first),
                        before.index(first) + self.weight_of(noisy["tenant"]),
                    )
