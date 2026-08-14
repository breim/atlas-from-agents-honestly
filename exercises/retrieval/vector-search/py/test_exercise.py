import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
INDEX = FIXTURE["index"]
STRATEGIES = ("post", "pre", "in-algorithm")

CASES = (
    (
        "similarity-orders-and-the-filter-makes-it-correct",
        "the nearest chunk is the wrong one",
    ),
    ("the-version-filter-is-not-optional", "applied whether or not it was asked for"),
    (
        "post-filtering-returns-fewer-than-k-when-the-filter-is-selective",
        "top-100 yields nothing usable",
    ),
    ("pre-filtering-finds-what-post-filtering-missed", "full recall, no approximation"),
    (
        "in-algorithm-filtering-gets-faster-as-the-filter-tightens",
        "the filter prunes the search",
    ),
    ("a-loose-filter-is-where-pre-filtering-stops-scaling", "distance to every member"),
    (
        "a-tenant-filter-never-leaks-another-tenants-chunk",
        "the filter is what makes it correct",
    ),
    ("no-match-is-an-empty-result-not-a-near-miss", "nothing is not almost something"),
)


def chunk_by_id(chunk_id: int) -> dict:
    return next(c for c in INDEX["chunks"] if c["id"] == chunk_id)


class VectorSearch(unittest.TestCase):
    def setUp(self):
        self.search = load_impl(__file__).search

    def go(
        self,
        entry: dict,
        strategy: str = None,
        filters: dict = None,
        k: int = None,
    ) -> dict:
        index = {**INDEX, "strategy": strategy or entry["strategy"]}
        return self.search(
            entry["query"],
            entry["filters"] if filters is None else filters,
            entry["k"] if k is None else k,
            index,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.go(entry), entry["result"])

    def test_a_superseded_chunk_is_never_returned_by_any_strategy(self):
        superseded = {
            c["id"] for c in INDEX["chunks"] if c["supersededAt"] is not None
        }
        self.assertTrue(superseded)
        for entry in FIXTURE["cases"]:
            for strategy in STRATEGIES:
                with self.subTest(f"{entry['id']}/{strategy}"):
                    for hit in self.go(entry, strategy)["results"]:
                        self.assertNotIn(hit["id"], superseded)

    def test_the_nearest_chunk_is_not_the_nearest_correct_chunk(self):
        entry = case(FIXTURE, "similarity-orders-and-the-filter-makes-it-correct")
        nearest = min(
            INDEX["chunks"],
            key=lambda c: abs(c["embedding"] - entry["query"]["point"]),
        )
        self.assertIsNotNone(nearest["supersededAt"])
        ids = [hit["id"] for hit in self.go(entry)["results"]]
        self.assertNotIn(nearest["id"], ids)

    def test_every_result_satisfies_every_filter_asked_for(self):
        for entry in FIXTURE["cases"]:
            for strategy in STRATEGIES:
                with self.subTest(f"{entry['id']}/{strategy}"):
                    for hit in self.go(entry, strategy)["results"]:
                        chunk = chunk_by_id(hit["id"])
                        for field, wanted in entry["filters"].items():
                            self.assertEqual(chunk[field], wanted)

    def test_no_tenant_filter_ever_returns_another_tenants_chunk(self):
        entry = case(FIXTURE, "the-version-filter-is-not-optional")
        tenants = sorted({c["tenantId"] for c in INDEX["chunks"]})
        for tenant_id in tenants:
            for strategy in STRATEGIES:
                with self.subTest(f"{tenant_id}/{strategy}"):
                    outcome = self.go(
                        entry, strategy, {"tenantId": tenant_id}, len(INDEX["chunks"])
                    )
                    for hit in outcome["results"]:
                        self.assertEqual(chunk_by_id(hit["id"])["tenantId"], tenant_id)

    def test_results_are_ordered_by_distance_and_never_exceed_k(self):
        for entry in FIXTURE["cases"]:
            for strategy in STRATEGIES:
                with self.subTest(f"{entry['id']}/{strategy}"):
                    results = self.go(entry, strategy)["results"]
                    self.assertLessEqual(len(results), entry["k"])
                    distances = [hit["distance"] for hit in results]
                    self.assertEqual(distances, sorted(distances))

    def test_shortfall_is_exactly_what_k_did_not_get(self):
        for entry in FIXTURE["cases"]:
            for strategy in STRATEGIES:
                with self.subTest(f"{entry['id']}/{strategy}"):
                    outcome = self.go(entry, strategy)
                    self.assertEqual(
                        outcome["shortfall"], entry["k"] - len(outcome["results"])
                    )
                    self.assertEqual(outcome["strategy"], strategy)

    def test_what_matched_is_a_property_of_the_filter_not_the_strategy(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                counts = {self.go(entry, s)["filtered"] for s in STRATEGIES}
                self.assertEqual(len(counts), 1)

    def test_pre_and_in_algorithm_agree_and_post_may_return_fewer(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                pre = self.go(entry, "pre")
                exact = self.go(entry, "in-algorithm")
                post = self.go(entry, "post")
                self.assertEqual(exact["results"], pre["results"])
                self.assertLessEqual(len(post["results"]), len(pre["results"]))
                pre_ids = {hit["id"] for hit in pre["results"]}
                for hit in post["results"]:
                    self.assertIn(hit["id"], pre_ids)

    def test_a_selective_filter_makes_in_algorithm_cheaper(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                post = self.go(entry, "post")
                exact = self.go(entry, "in-algorithm")
                self.assertEqual(post["scanned"], len(INDEX["chunks"]))
                self.assertLessEqual(exact["scanned"], post["scanned"])
                self.assertLessEqual(exact["scanned"], exact["filtered"])

    def test_post_filtering_only_returns_rows_the_probe_reached(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                ordered = sorted(
                    INDEX["chunks"],
                    key=lambda c: (
                        abs(c["embedding"] - entry["query"]["point"]),
                        c["id"],
                    ),
                )
                window = {c["id"] for c in ordered[: INDEX["probe"]]}
                for hit in self.go(entry, "post")["results"]:
                    self.assertIn(hit["id"], window)

    def test_the_graph_walk_never_scans_more_than_its_probe_budget(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                exact = self.go(entry, "in-algorithm")
                self.assertLessEqual(exact["scanned"], INDEX["probe"])
                pre = self.go(entry, "pre")
                if pre["filtered"] > INDEX["probe"]:
                    self.assertLess(exact["scanned"], pre["scanned"])

    def test_pre_filtering_scans_every_matching_row(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                pre = self.go(entry, "pre")
                self.assertEqual(pre["scanned"], pre["filtered"])

    def test_tightening_a_filter_never_costs_in_algorithm_more_work(self):
        entry = case(FIXTURE, "the-version-filter-is-not-optional")
        tight_filter = {"tier": "contract", "region": "us", "tenantId": "meridian"}
        loose = self.go(entry, "in-algorithm", {})
        tight = self.go(entry, "in-algorithm", tight_filter)
        self.assertLess(tight["filtered"], loose["filtered"])
        self.assertLessEqual(tight["scanned"], loose["scanned"])
        loose_post = self.go(entry, "post", {})
        tight_post = self.go(entry, "post", tight_filter)
        self.assertEqual(tight_post["scanned"], loose_post["scanned"])
        self.assertGreater(tight_post["shortfall"], loose_post["shortfall"])
