import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("no-pair-clears-the-threshold", "weak matches leave records alone"),
    ("a-matching-pair-merges", "a confident match makes a cluster"),
    ("the-threshold-is-inclusive", "exactly at the bar merges"),
    ("one-basis-point-under-does-not-merge", "one basis point under does not"),
    ("a-chain-merges-records-that-never-matched-each-other", "transitivity is not optional"),
    ("an-uncompared-pair-never-merges", "blocking decides what can ever merge"),
    ("two-independent-clusters-stay-separate", "separate components stay separate"),
    ("everything-can-collapse-into-one-cluster", "a chain of matches becomes one blob"),
    ("no-pairs-leaves-every-record-alone", "no comparisons is all singletons"),
)


class EntityResolution(unittest.TestCase):
    def setUp(self):
        self.resolve = load_impl(__file__).resolve

    def run_case(self, entry: dict) -> list:
        return self.resolve(FIXTURE["records"], entry["pairs"], FIXTURE["threshold"])

    def components(self, entry: dict):
        parent = {r: r for r in FIXTURE["records"]}

        def find(record):
            while parent[record] != record:
                record = parent[record]
            return record

        for pair in entry["pairs"]:
            if pair["score"] >= FIXTURE["threshold"]:
                parent[find(pair["a"])] = find(pair["b"])
        return find

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["clusters"])

    def test_every_record_lands_in_exactly_one_cluster(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flat = [r for cluster in self.run_case(entry) for r in cluster]
                self.assertEqual(sorted(flat), sorted(FIXTURE["records"]))

    def test_every_matching_pair_ends_up_together(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                clusters = self.run_case(entry)
                for pair in entry["pairs"]:
                    if pair["score"] < FIXTURE["threshold"]:
                        continue
                    holding = next(c for c in clusters if pair["a"] in c)
                    self.assertIn(pair["b"], holding)

    def test_two_records_only_share_a_cluster_through_a_chain(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                find = self.components(entry)
                for cluster in self.run_case(entry):
                    for record in cluster:
                        self.assertEqual(find(record), find(cluster[0]))

    def test_pair_order_never_changes_the_clusters(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flipped = self.resolve(
                    FIXTURE["records"], list(reversed(entry["pairs"])), FIXTURE["threshold"]
                )
                self.assertEqual(flipped, self.run_case(entry))

    def test_raising_the_threshold_never_merges_more(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                stricter = self.resolve(
                    FIXTURE["records"], entry["pairs"], FIXTURE["threshold"] + 1000
                )
                self.assertGreaterEqual(len(stricter), len(self.run_case(entry)))
