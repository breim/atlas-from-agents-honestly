import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-low-authority-task-reads-the-mixed-corpus-and-is-tainted", "every writer"),
    (
        "a-high-authority-task-never-reads-attacker-writable-text",
        "the trifecta, broken where it counts",
    ),
    ("a-high-authority-task-on-a-first-party-split-is-served", "split by trust"),
    (
        "the-ratio-is-against-what-competes-for-the-query-not-the-corpus",
        "five documents in millions",
    ),
    ("a-source-that-changed-since-ingestion-is-refused", "a vendor page that turned hostile"),
    ("provenance-inferred-from-content-is-refused", "a column, not a guess"),
    ("a-first-party-only-corpus-is-not-tainted", "taint follows provenance"),
    ("nothing-competes-so-there-is-nothing-to-cite", "citations that resolve"),
)


class UntrustedRetrieval(unittest.TestCase):
    def setUp(self):
        self.retrieve = load_impl(__file__).retrieve

    def go(self, entry, chunks=None, task=None, policy=None):
        return self.retrieve(
            entry["chunks"] if chunks is None else chunks,
            task or entry["task"],
            policy or entry["policy"],
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_refused_retrieval_hands_over_nothing(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "refused":
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(outcome["chunks"], [])
                self.assertEqual(outcome["citations"], [])
                self.assertFalse(outcome["tainted"])
                self.assertTrue(outcome["errors"])

    def test_a_high_authority_task_refuses_disallowed_provenance(self):
        entry = case(FIXTURE, "a-low-authority-task-reads-the-mixed-corpus-and-is-tainted")
        provenances = {c["provenance"] for c in entry["chunks"]}
        for provenance in provenances:
            if provenance == "inferred":
                continue
            with self.subTest(provenance):
                only = [
                    {**c, "provenance": provenance}
                    for c in entry["chunks"]
                    if entry["task"]["query"] in c["competesFor"]
                ]
                high = self.go(entry, only, {**entry["task"], "authority": "high"})
                allowed = provenance in entry["policy"]["highAuthorityProvenance"]
                self.assertEqual(high["status"] == "served", allowed)
                low = self.go(entry, only, {**entry["task"], "authority": "low"})
                self.assertEqual(low["status"], "served")

    def test_the_same_corpus_is_safe_for_one_task_and_refused_for_another(self):
        entry = case(FIXTURE, "a-high-authority-task-never-reads-attacker-writable-text")
        high = self.go(entry)
        low = self.go(entry, None, {**entry["task"], "authority": "low"})
        self.assertEqual(high["status"], "refused")
        self.assertEqual(low["status"], "served")
        self.assertTrue(low["tainted"])

    def test_the_poison_ratio_ignores_non_competing_chunks(self):
        entry = case(FIXTURE, "the-ratio-is-against-what-competes-for-the-query-not-the-corpus")
        small = case(FIXTURE, "a-low-authority-task-reads-the-mixed-corpus-and-is-tainted")
        padded = self.go(entry)
        bare = self.go(small)
        self.assertGreater(len(entry["chunks"]), len(small["chunks"]) * 5)
        self.assertEqual(padded["poisonRatioBps"], bare["poisonRatioBps"])
        self.assertEqual(padded["competingForQuery"], bare["competingForQuery"])

    def test_the_ratio_is_poisoned_over_competing_in_basis_points(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "served":
                continue
            with self.subTest(entry["id"]):
                competing = [
                    c
                    for c in entry["chunks"]
                    if entry["task"]["query"] in c["competesFor"]
                ]
                poisoned = len(
                    [c for c in competing if c["provenance"] == "customer-writable"]
                )
                owed = 0 if not competing else int(poisoned * 10000 / len(competing) + 0.5)
                self.assertEqual(outcome["poisonRatioBps"], owed)

    def test_a_run_is_tainted_exactly_when_non_first_party_is_served(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "served":
                continue
            with self.subTest(entry["id"]):
                served = [c for c in entry["chunks"] if c["id"] in outcome["chunks"]]
                self.assertEqual(
                    outcome["tainted"],
                    any(c["provenance"] != "first-party" for c in served),
                )

    def test_a_drifted_source_is_always_refused_and_named(self):
        entry = case(FIXTURE, "a-first-party-only-corpus-is-not-tainted")
        for chunk in entry["chunks"]:
            with self.subTest(chunk["id"]):
                drifted = [
                    {**c, "contentHash": c["ingestedHash"] + "-changed"}
                    if c["id"] == chunk["id"]
                    else c
                    for c in entry["chunks"]
                ]
                outcome = self.go(entry, drifted)
                self.assertEqual(outcome["status"], "refused")
                self.assertEqual(outcome["drifted"], [chunk["id"]])

    def test_inferred_provenance_is_refused_wherever_it_appears(self):
        entry = case(FIXTURE, "a-first-party-only-corpus-is-not-tainted")
        for chunk in entry["chunks"]:
            with self.subTest(chunk["id"]):
                guessed = [
                    {**c, "provenance": "inferred"} if c["id"] == chunk["id"] else c
                    for c in entry["chunks"]
                ]
                outcome = self.go(entry, guessed)
                self.assertEqual(outcome["status"], "refused")
                self.assertTrue(any(chunk["id"] in e for e in outcome["errors"]))

    def test_every_served_chunk_is_cited_and_every_citation_resolves(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                outcome = self.go(entry)
                self.assertEqual(outcome["citations"], outcome["chunks"])
                ids = {c["id"] for c in entry["chunks"]}
                for cited in outcome["citations"]:
                    self.assertIn(cited, ids)

    def test_the_writer_list_is_every_writer_behind_what_was_served(self):
        for entry in FIXTURE["cases"]:
            outcome = self.go(entry)
            if outcome["status"] != "served":
                continue
            with self.subTest(entry["id"]):
                owed = sorted(
                    {
                        w
                        for c in entry["chunks"]
                        if c["id"] in outcome["chunks"]
                        for w in c["writers"]
                    }
                )
                self.assertEqual(outcome["writers"], owed)

    def test_a_task_with_no_competing_chunks_cannot_cite(self):
        entry = case(FIXTURE, "nothing-competes-so-there-is-nothing-to-cite")
        self.assertEqual(self.go(entry)["status"], "refused")
        relaxed = self.go(
            entry, None, None, {**entry["policy"], "requireCitations": False}
        )
        self.assertEqual(relaxed["status"], "served")
        self.assertEqual(relaxed["chunks"], [])
