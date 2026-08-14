import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
CONFIG = FIXTURE["config"]
DOCUMENTS = FIXTURE["documents"]
QUESTIONS = FIXTURE["questions"]
STRATEGIES = ("structural", "fixed")

CASES = (
    ("structural-splitting-keeps-a-rule-with-its-exception", "the cut that never happens"),
    (
        "fixed-size-splitting-cuts-the-rule-from-its-exception",
        "the bug you will not see in a metric",
    ),
    ("a-table-is-one-chunk-however-large", "atomic, or it is noise"),
    (
        "a-document-with-no-headings-still-produces-one-parent",
        "transcripts have nothing to split on",
    ),
    ("an-empty-document-produces-nothing", "no blocks, no chunks"),
)


def blocks_of(name: str) -> list:
    return DOCUMENTS[name]["blocks"]


def block_of(name: str, block_id: str) -> dict:
    return next(b for b in blocks_of(name) if b["id"] == block_id)


class Chunking(unittest.TestCase):
    def setUp(self):
        self.chunk = load_impl(__file__).chunk

    def go(self, name: str, strategy: str) -> dict:
        return self.chunk(DOCUMENTS[name], {**CONFIG, "strategy": strategy})

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(
                    self.go(entry["document"], entry["strategy"]), entry["result"]
                )

    def test_the_child_that_matches_does_not_answer_but_its_parent_does(self):
        for question in QUESTIONS:
            with self.subTest(question["id"]):
                fixed = self.go(question["document"], "fixed")
                child = next(
                    c
                    for c in fixed["children"]
                    if question["matchingBlock"] in c["blockIds"]
                )
                # The retrieval eval passes: the right chunk was returned. The answer is wrong.
                missing = [
                    b for b in question["requiresBlocks"] if b not in child["blockIds"]
                ]
                self.assertTrue(missing)
                parent = next(
                    p for p in fixed["parents"] if p["id"] == child["parentId"]
                )
                for block_id in question["requiresBlocks"]:
                    self.assertIn(block_id, parent["blockIds"])

    def test_structural_splitting_leaves_every_child_answerable(self):
        for question in QUESTIONS:
            with self.subTest(question["id"]):
                child = next(
                    c
                    for c in self.go(question["document"], "structural")["children"]
                    if question["matchingBlock"] in c["blockIds"]
                )
                for block_id in question["requiresBlocks"]:
                    self.assertIn(block_id, child["blockIds"])

    def test_no_child_begins_with_a_block_that_cannot_stand_first(self):
        for name in DOCUMENTS:
            with self.subTest(name):
                for child in self.go(name, "structural")["children"]:
                    first = block_of(name, child["blockIds"][0])
                    self.assertNotIn(first["kind"], CONFIG["neverStartsAChunk"])

    def test_a_chunk_goes_over_its_cap_rather_than_make_a_forbidden_cut(self):
        entry = case(FIXTURE, "structural-splitting-keeps-a-rule-with-its-exception")
        name = entry["document"]
        over = [
            c
            for c in self.go(name, "structural")["children"]
            if c["tokens"] > CONFIG["maxChildTokens"]
        ]
        self.assertTrue(over)
        for child in over:
            held_back = any(
                block_of(name, b)["kind"] in CONFIG["neverStartsAChunk"]
                for b in child["blockIds"][1:]
            )
            self.assertTrue(held_back or len(child["blockIds"]) == 1)

    def test_every_block_appears_in_exactly_one_child_or_is_a_heading(self):
        for name in DOCUMENTS:
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    children = self.go(name, strategy)["children"]
                    seen = [b for c in children for b in c["blockIds"]]
                    self.assertEqual(len(set(seen)), len(seen))
                    owed = [
                        b["id"] for b in blocks_of(name) if b["kind"] != "heading"
                    ]
                    self.assertEqual(seen, owed)

    def test_every_chunk_carries_the_document_and_version(self):
        for name, document in DOCUMENTS.items():
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    outcome = self.go(name, strategy)
                    for item in outcome["parents"] + outcome["children"]:
                        self.assertEqual(item["documentId"], document["documentId"])
                        self.assertEqual(item["version"], document["version"])

    def test_a_child_carries_the_trail_of_its_parent(self):
        for name in DOCUMENTS:
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    outcome = self.go(name, strategy)
                    for child in outcome["children"]:
                        parent = next(
                            p
                            for p in outcome["parents"]
                            if p["id"] == child["parentId"]
                        )
                        self.assertEqual(child["trail"], parent["trail"])

    def test_the_heading_trail_is_the_ancestry(self):
        parents = self.go("policy", "structural")["parents"]
        headings = [b for b in blocks_of("policy") if b["kind"] == "heading"]
        self.assertEqual(len(parents), len(headings))
        for parent, heading in zip(parents, headings):
            self.assertEqual(len(parent["trail"]), heading["level"])
            self.assertEqual(parent["trail"][-1], heading["text"])

    def test_a_heading_always_starts_a_new_parent(self):
        for name in DOCUMENTS:
            headings = [b for b in blocks_of(name) if b["kind"] == "heading"]
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    parents = self.go(name, strategy)["parents"]
                    if headings:
                        self.assertEqual(len(parents), len(headings))
                    for parent in parents:
                        self.assertTrue(parent["blockIds"])

    def test_a_parent_is_the_sum_of_what_it_contains(self):
        for name in DOCUMENTS:
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    outcome = self.go(name, strategy)
                    for parent in outcome["parents"]:
                        owed = sum(
                            block_of(name, b)["tokens"] for b in parent["blockIds"]
                        )
                        self.assertEqual(parent["tokens"], owed)
                        mine = [
                            c
                            for c in outcome["children"]
                            if c["parentId"] == parent["id"]
                        ]
                        self.assertLessEqual(
                            sum(c["tokens"] for c in mine), parent["tokens"]
                        )
                    for child in outcome["children"]:
                        owed = sum(
                            block_of(name, b)["tokens"] for b in child["blockIds"]
                        )
                        self.assertEqual(child["tokens"], owed)

    def test_no_chunk_stops_early(self):
        for name in DOCUMENTS:
            for strategy in STRATEGIES:
                with self.subTest(f"{name}/{strategy}"):
                    children = self.go(name, strategy)["children"]
                    for index, child in enumerate(children[:-1]):
                        following = children[index + 1]
                        if following["parentId"] != child["parentId"]:
                            continue
                        first = block_of(name, following["blockIds"][0])
                        self.assertGreater(
                            child["tokens"] + first["tokens"],
                            CONFIG["maxChildTokens"],
                        )

    def test_the_strategy_never_changes_what_parents_are(self):
        for name in DOCUMENTS:
            with self.subTest(name):
                self.assertEqual(
                    self.go(name, "fixed")["parents"],
                    self.go(name, "structural")["parents"],
                )

    def test_fixed_packing_never_produces_fewer_chunks(self):
        for name in DOCUMENTS:
            with self.subTest(name):
                self.assertGreaterEqual(
                    len(self.go(name, "fixed")["children"]),
                    len(self.go(name, "structural")["children"]),
                )
