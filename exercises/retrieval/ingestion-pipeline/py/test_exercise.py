import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
INDEX = FIXTURE["index"]

CASES = (
    (
        "an-unchanged-document-is-skipped-not-reparsed",
        "the hash matched, so nothing happened",
    ),
    ("a-timestamp-that-moved-without-the-content-changes-nothing", "not by timestamp"),
    (
        "a-changed-document-is-reindexed-and-its-old-chunks-replaced",
        "replaced, not appended",
    ),
    (
        "a-document-deleted-upstream-stops-being-searchable",
        "the part almost nobody implements",
    ),
    ("a-document-with-no-tenant-is-rejected-not-indexed-untagged", "fail loudly"),
    (
        "a-parse-failure-is-named-in-the-manifest-not-silently-skipped",
        "do you know which thirteen",
    ),
    ("a-pipeline-version-bump-reindexes-everything", "why pipeline_ver is on every row"),
    (
        "reconciliation-removes-exactly-what-the-source-no-longer-has",
        "list, diff, remove",
    ),
)


class IngestionPipeline(unittest.TestCase):
    def setUp(self):
        self.ingest = load_impl(__file__).ingest

    @staticmethod
    def config_of(entry: dict) -> dict:
        if "pipelineVersion" in entry:
            return {**CONFIG, "pipelineVersion": entry["pipelineVersion"]}
        return CONFIG

    def go(
        self,
        entry: dict,
        sources: list = None,
        index: dict = None,
        config: dict = None,
    ) -> dict:
        return self.ingest(
            entry["sources"] if sources is None else sources,
            index or INDEX,
            config or self.config_of(entry),
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_running_the_pipeline_again_changes_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                first = self.go(entry)
                second = self.go(entry, None, {"chunks": first["chunks"]})
                self.assertEqual(second["chunks"], first["chunks"])
                self.assertEqual(second["manifest"]["chunksProduced"], 0)
                self.assertEqual(second["manifest"]["reindexed"], [])
                self.assertEqual(second["manifest"]["tombstoned"], [])

    def test_a_rerun_replaces_chunks_instead_of_doubling_them(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ids = [c["id"] for c in self.go(entry)["chunks"]]
                self.assertEqual(len(set(ids)), len(ids))
        changed = case(
            FIXTURE, "a-changed-document-is-reindexed-and-its-old-chunks-replaced"
        )
        stale = [
            c
            for c in self.go(changed)["chunks"]
            if c["documentId"] == "POL-114" and c["contentHash"] == "h114a"
        ]
        self.assertEqual(stale, [])

    def test_chunk_identity_is_the_document_and_its_position(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                by_document = {}
                for chunk in self.go(entry)["chunks"]:
                    by_document.setdefault(chunk["documentId"], []).append(chunk["id"])
                for document_id, ids in by_document.items():
                    self.assertEqual(
                        ids,
                        [f"{document_id}#{position}" for position in range(len(ids))],
                    )

    def test_a_document_is_skipped_exactly_when_hash_and_version_match(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                config = self.config_of(entry)
                outcome = self.go(entry)
                rejected = {r["documentId"] for r in outcome["manifest"]["rejected"]}
                for source in entry["sources"]:
                    if not source["parseOk"]:
                        continue
                    existing = [
                        c
                        for c in INDEX["chunks"]
                        if c["documentId"] == source["documentId"]
                    ]
                    owed = (
                        bool(existing)
                        and all(
                            c["contentHash"] == source["contentHash"]
                            and c["pipelineVersion"] == config["pipelineVersion"]
                            for c in existing
                        )
                        and source["documentId"] not in rejected
                    )
                    self.assertEqual(
                        source["documentId"] in outcome["manifest"]["skipped"], owed
                    )

    def test_only_the_content_hash_decides_whether_work_happens(self):
        entry = case(FIXTURE, "an-unchanged-document-is-skipped-not-reparsed")
        touched = [{**s, "modifiedAt": "2099-12-31"} for s in entry["sources"]]
        self.assertEqual(self.go(entry, touched), self.go(entry))
        edited = [
            {**s, "contentHash": s["contentHash"] + "-new"} for s in entry["sources"]
        ]
        after = self.go(entry, edited)
        self.assertEqual(after["manifest"]["skipped"], [])
        self.assertEqual(
            after["manifest"]["reindexed"],
            [s["documentId"] for s in entry["sources"]],
        )

    def test_everything_the_source_no_longer_has_is_tombstoned(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                present = {s["documentId"] for s in entry["sources"]}
                indexed = []
                for chunk in INDEX["chunks"]:
                    if chunk["documentId"] not in indexed:
                        indexed.append(chunk["documentId"])
                owed = [d for d in indexed if d not in present]
                self.assertEqual(self.go(entry)["manifest"]["tombstoned"], owed)

    def test_a_tombstoned_document_leaves_no_chunk_behind(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for document_id in outcome["manifest"]["tombstoned"]:
                    self.assertFalse(
                        any(
                            c["documentId"] == document_id for c in outcome["chunks"]
                        )
                    )

    def test_a_parse_failure_never_deletes_what_was_already_indexed(self):
        entry = case(
            FIXTURE, "a-parse-failure-is-named-in-the-manifest-not-silently-skipped"
        )
        outcome = self.go(entry)
        self.assertTrue(outcome["manifest"]["failed"])
        for failure in outcome["manifest"]["failed"]:
            self.assertTrue(failure["reason"])
            self.assertNotIn(
                failure["documentId"], outcome["manifest"]["tombstoned"]
            )

    def test_nothing_is_indexed_without_the_metadata_the_filters_need(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                for chunk in outcome["chunks"]:
                    for field in CONFIG["requiredMetadata"]:
                        self.assertIsNotNone(chunk[field])
                        self.assertNotEqual(chunk[field], "")
                for rejection in outcome["manifest"]["rejected"]:
                    self.assertNotIn(
                        rejection["documentId"], outcome["manifest"]["reindexed"]
                    )
                    source = next(
                        s
                        for s in entry["sources"]
                        if s["documentId"] == rejection["documentId"]
                    )
                    self.assertFalse(
                        any(
                            c["contentHash"] == source["contentHash"]
                            for c in outcome["chunks"]
                        )
                    )

    def test_every_reindexed_chunk_carries_this_pipeline_version(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                config = self.config_of(entry)
                outcome = self.go(entry)
                for document_id in outcome["manifest"]["reindexed"]:
                    for chunk in outcome["chunks"]:
                        if chunk["documentId"] != document_id:
                            continue
                        self.assertEqual(
                            chunk["pipelineVersion"], config["pipelineVersion"]
                        )

    def test_a_pipeline_version_bump_leaves_nothing_on_the_old_version(self):
        entry = case(FIXTURE, "an-unchanged-document-is-skipped-not-reparsed")
        bumped = {**CONFIG, "pipelineVersion": "e5-large/chunk-v9/3072"}
        outcome = self.go(entry, None, None, bumped)
        self.assertEqual(outcome["manifest"]["skipped"], [])
        for chunk in outcome["chunks"]:
            self.assertEqual(chunk["pipelineVersion"], bumped["pipelineVersion"])

    def test_the_manifest_accounts_for_every_document(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                manifest = outcome["manifest"]
                self.assertEqual(manifest["attempted"], len(entry["sources"]))
                self.assertEqual(manifest["sourceCount"], len(entry["sources"]))
                self.assertEqual(manifest["indexedCount"], len(outcome["chunks"]))
                self.assertEqual(
                    manifest["parsed"],
                    len([s for s in entry["sources"] if s["parseOk"]]),
                )
                self.assertEqual(
                    manifest["parsed"] + len(manifest["failed"]), manifest["attempted"]
                )
                accounted = (
                    manifest["skipped"]
                    + manifest["reindexed"]
                    + [r["documentId"] for r in manifest["rejected"]]
                    + [f["documentId"] for f in manifest["failed"]]
                )
                self.assertEqual(
                    sorted(accounted),
                    sorted(s["documentId"] for s in entry["sources"]),
                )

    def test_chunks_produced_is_exactly_what_was_written(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                owed = sum(
                    s["chunkCount"]
                    for s in entry["sources"]
                    if s["documentId"] in outcome["manifest"]["reindexed"]
                )
                self.assertEqual(outcome["manifest"]["chunksProduced"], owed)
