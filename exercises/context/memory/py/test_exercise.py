import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
NOW = FIXTURE["now"]
POLICY = FIXTURE["policy"]
STORE = FIXTURE["store"]

CASES = (
    (
        "the-highest-authority-wins-before-the-most-recent",
        "a human beats a fresher inference",
    ),
    ("a-superseded-fact-never-wins-however-recent", "the append-only trap"),
    ("a-stale-fact-is-surfaced-with-its-age-not-dropped", "as of eighteen months ago"),
    (
        "an-unknown-predicate-falls-back-to-the-default-expiry",
        "no single expiry fits everything",
    ),
    ("a-fact-from-another-tenant-is-never-recalled", "leakage"),
    ("a-model-inference-is-never-written", "conclusions belong to a run"),
    ("a-secret-is-never-written-to-memory", "replayed verbatim, forever"),
    ("a-write-without-provenance-is-rejected", "four fields or it is a string"),
    (
        "a-human-correction-supersedes-and-takes-effect-at-once",
        "contradiction has an answer",
    ),
)


def authority_of(asserted_by: str) -> str:
    return asserted_by.split(":")[0]


class MemoryBuild(unittest.TestCase):
    def setUp(self):
        self.remember = load_impl(__file__).remember

    def go(self, entry: dict, request: dict = None, now: int = None) -> dict:
        return self.remember(
            entry["request"] if request is None else request,
            STORE,
            POLICY,
            NOW if now is None else now,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_every_read_gets_exactly_one_answer_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(
                    [item["predicate"] for item in outcome["recalled"]],
                    entry["request"]["reads"],
                )

    def test_a_recalled_fact_belongs_to_the_asking_tenant_and_subject(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                pool = STORE["facts"] + [
                    w
                    for w in entry["request"]["writes"]
                    if w["id"] in outcome["admitted"]
                ]
                for item in outcome["recalled"]:
                    if item["value"] is None:
                        continue
                    origin = next(
                        f
                        for f in pool
                        if f["predicate"] == item["predicate"]
                        and f["value"] == item["value"]
                        and f["source"] == item["source"]
                    )
                    self.assertEqual(origin["tenantId"], entry["request"]["tenantId"])
                    self.assertEqual(origin["subject"], entry["request"]["subject"])

    def test_no_tenant_can_read_another_tenants_facts(self):
        entry = case(FIXTURE, "the-highest-authority-wins-before-the-most-recent")
        predicates = sorted({f["predicate"] for f in STORE["facts"]})
        stranger = {
            "tenantId": "no_such_tenant",
            "subject": "account:4471",
            "reads": predicates,
            "writes": [],
        }
        for item in self.go(entry, stranger)["recalled"]:
            self.assertIsNone(item["value"], item["predicate"])

    def test_a_superseded_fact_is_never_the_winner(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                pool = STORE["facts"] + [
                    w
                    for w in entry["request"]["writes"]
                    if w["id"] in outcome["admitted"]
                ]
                retired = {f["supersedes"] for f in pool if f["supersedes"]}
                for item in outcome["recalled"]:
                    if item["value"] is None:
                        continue
                    winner = next(
                        f
                        for f in pool
                        if f["predicate"] == item["predicate"]
                        and f["value"] == item["value"]
                        and f["source"] == item["source"]
                    )
                    self.assertNotIn(winner["id"], retired)

    def test_nothing_with_lower_authority_than_the_winner_is_chosen(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                pool = STORE["facts"] + [
                    w
                    for w in entry["request"]["writes"]
                    if w["id"] in outcome["admitted"]
                ]
                retired = {f["supersedes"] for f in pool if f["supersedes"]}
                for item in outcome["recalled"]:
                    if item["assertedBy"] is None:
                        continue
                    rank = POLICY["authorityRank"][authority_of(item["assertedBy"])]
                    rivals = [
                        f
                        for f in pool
                        if f["tenantId"] == entry["request"]["tenantId"]
                        and f["subject"] == entry["request"]["subject"]
                        and f["predicate"] == item["predicate"]
                        and f["id"] not in retired
                    ]
                    for rival in rivals:
                        rival_rank = POLICY["authorityRank"][
                            authority_of(rival["assertedBy"])
                        ]
                        self.assertGreaterEqual(rank, rival_rank)
                        if rival_rank == rank:
                            self.assertGreaterEqual(
                                item["assertedOnDay"], rival["assertedOnDay"]
                            )

    def test_staleness_is_age_against_the_type_expiry(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for item in self.go(entry)["recalled"]:
                    if item["value"] is None:
                        self.assertFalse(item["stale"])
                        continue
                    ttl = POLICY["ttlDays"].get(
                        item["predicate"], POLICY["defaultTtlDays"]
                    )
                    self.assertEqual(item["ageDays"], NOW - item["assertedOnDay"])
                    self.assertEqual(item["stale"], item["ageDays"] > ttl)

    def test_a_fact_goes_stale_without_ever_disappearing(self):
        entry = case(FIXTURE, "the-highest-authority-wins-before-the-most-recent")
        fresh = self.go(entry)
        later = self.go(entry, None, NOW + 10000)
        self.assertFalse(fresh["recalled"][0]["stale"])
        self.assertTrue(later["recalled"][0]["stale"])
        self.assertEqual(later["recalled"][0]["value"], fresh["recalled"][0]["value"])
        self.assertGreater(
            later["recalled"][0]["ageDays"], fresh["recalled"][0]["ageDays"]
        )

    def test_every_write_is_admitted_or_rejected_never_both(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                seen = outcome["admitted"] + [r["id"] for r in outcome["rejected"]]
                self.assertEqual(
                    sorted(seen),
                    sorted(w["id"] for w in entry["request"]["writes"]),
                )
                for item in outcome["rejected"]:
                    self.assertTrue(item["reason"])
                    self.assertNotIn(item["id"], outcome["admitted"])

    def test_a_rejected_write_changes_nothing_that_is_recalled(self):
        for entry in FIXTURE["cases"]:
            if not entry["request"]["writes"]:
                continue
            outcome = self.go(entry)
            if outcome["admitted"]:
                continue
            with self.subTest(entry["id"]):
                without = self.go(entry, {**entry["request"], "writes": []})
                self.assertEqual(outcome["recalled"], without["recalled"])

    def test_a_model_inference_and_a_secret_are_refused(self):
        entry = case(FIXTURE, "the-highest-authority-wins-before-the-most-recent")
        base = {
            "id": "fact-probe",
            "tenantId": "acme",
            "subject": "account:4471",
            "predicate": "payment_terms",
            "value": "net-45",
            "source": "ticket:9000",
            "assertedBy": "human:jvega",
            "assertedOnDay": 1799,
            "supersedes": None,
        }
        inference = self.go(
            entry,
            {**entry["request"], "writes": [{**base, "assertedBy": "model:atlas"}]},
        )
        self.assertEqual(inference["admitted"], [])
        secret = self.go(
            entry,
            {
                **entry["request"],
                "writes": [{**base, "predicate": POLICY["secretPredicates"][0]}],
            },
        )
        self.assertEqual(secret["admitted"], [])
        good = self.go(entry, {**entry["request"], "writes": [base]})
        self.assertEqual(good["admitted"], ["fact-probe"])
