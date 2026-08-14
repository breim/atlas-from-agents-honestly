import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    (
        "a-replica-that-matches-the-source-is-in-sync",
        "an equal replica reports nothing to repair",
    ),
    (
        "a-clean-event-log-still-leaves-a-record-missing",
        "the event that never arrived left no trace",
    ),
    ("an-older-version-in-the-projection-is-stale", "a behind version needs refetching"),
    (
        "a-newer-version-in-the-projection-is-not-stale",
        "an ahead version is skew, not staleness",
    ),
    ("a-record-the-source-dropped-is-extra", "a tombstone that never applied"),
    ("a-partial-snapshot-never-derives-a-deletion", "page four might have held it"),
    (
        "a-partial-snapshot-still-reports-what-it-did-see",
        "a partial listing still proves existence",
    ),
    (
        "a-matching-partial-snapshot-is-still-not-in-sync",
        "agreement with half the truth proves nothing",
    ),
    (
        "the-lists-follow-snapshot-order-then-projection-order",
        "the report order is fixed",
    ),
    ("an-empty-source-empties-the-projection", "everything local is now extra"),
    ("two-empty-sides-are-in-sync", "nothing on either side agrees trivially"),
)


class EnterpriseIntegrations(unittest.TestCase):
    def setUp(self):
        self.reconcile = load_impl(__file__).reconcile

    def run_case(self, entry: dict) -> dict:
        return self.reconcile(entry["snapshot"], entry["projection"])

    @staticmethod
    def ids(records: list) -> list:
        return [record["id"] for record in records]

    @staticmethod
    def versions(records: list) -> dict:
        return {record["id"]: record["version"] for record in records}

    def partial_cases(self) -> list:
        return [e for e in FIXTURE["cases"] if not e["snapshot"]["complete"]]

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_a_partial_snapshot_never_reports_anything_as_extra(self):
        for entry in self.partial_cases():
            with self.subTest(entry["id"]):
                self.assertEqual(self.run_case(entry)["extra"], [])

    def test_a_partial_snapshot_is_never_in_sync(self):
        for entry in self.partial_cases():
            with self.subTest(entry["id"]):
                self.assertFalse(self.run_case(entry)["inSync"])

    def test_in_sync_is_true_exactly_when_complete_and_nothing_differs(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                clean = not any(
                    result[key] for key in ("missing", "stale", "ahead", "extra")
                )
                self.assertEqual(
                    result["inSync"], entry["snapshot"]["complete"] and clean
                )

    def test_every_reported_id_comes_from_one_of_the_two_sides(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                known = set(self.ids(entry["snapshot"]["records"])) | set(
                    self.ids(entry["projection"])
                )
                for key in ("missing", "stale", "ahead", "extra"):
                    for record_id in result[key]:
                        self.assertIn(record_id, known)

    def test_no_id_is_ever_reported_in_two_categories_at_once(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                reported = [
                    record_id
                    for key in ("missing", "stale", "ahead", "extra")
                    for record_id in result[key]
                ]
                self.assertEqual(len(set(reported)), len(reported))

    def test_missing_and_extra_hold_only_ids_the_other_side_lacks(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                source = set(self.ids(entry["snapshot"]["records"]))
                local = set(self.ids(entry["projection"]))
                for record_id in result["missing"]:
                    self.assertIn(record_id, source)
                    self.assertNotIn(record_id, local)
                for record_id in result["extra"]:
                    self.assertIn(record_id, local)
                    self.assertNotIn(record_id, source)

    def test_stale_and_ahead_sit_on_the_right_side_of_the_version(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                source = self.versions(entry["snapshot"]["records"])
                local = self.versions(entry["projection"])
                for record_id in result["stale"]:
                    self.assertLess(local[record_id], source[record_id])
                for record_id in result["ahead"]:
                    self.assertGreater(local[record_id], source[record_id])

    def test_reconciling_a_projection_against_itself_finds_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                snapshot = {"complete": True, "records": entry["projection"]}
                self.assertEqual(
                    self.reconcile(snapshot, entry["projection"]),
                    {
                        "missing": [],
                        "stale": [],
                        "ahead": [],
                        "extra": [],
                        "inSync": True,
                    },
                )

    def test_applying_the_repair_makes_the_replica_match_the_source(self):
        for entry in FIXTURE["cases"]:
            if not entry["snapshot"]["complete"]:
                continue
            with self.subTest(entry["id"]):
                repaired = [dict(record) for record in entry["snapshot"]["records"]]
                self.assertTrue(self.reconcile(entry["snapshot"], repaired)["inSync"])
