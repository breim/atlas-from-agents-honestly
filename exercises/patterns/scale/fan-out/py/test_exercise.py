import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("everything-fits-in-one-wave", "work under the cap runs in one go"),
    ("the-concurrency-cap-splits-the-work", "the cap decides how many run together"),
    ("one-failure-does-not-cancel-the-others", "a sibling failure is not contagious"),
    ("a-failure-does-not-stop-later-waves", "a first-wave failure does not abort the batch"),
    ("every-item-failing-is-still-every-item-reported", "total failure still reports per item"),
    ("a-limit-of-one-is-sequential", "a cap of one is a legitimate setting"),
    ("no-items-produce-no-waves", "nothing to do is no waves"),
)


class FanOut(unittest.TestCase):
    def setUp(self):
        self.fan_out = load_impl(__file__).fan_out

    def run_case(self, entry: dict) -> dict:
        return self.fan_out(entry["items"], entry["limit"], entry["failures"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_every_item_gets_one_result_in_input_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                results = self.run_case(entry)["results"]
                self.assertEqual([r["item"] for r in results], entry["items"])

    def test_no_wave_ever_exceeds_the_cap(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for wave in self.run_case(entry)["waves"]:
                    self.assertLessEqual(len(wave), entry["limit"])

    def test_the_waves_partition_the_items(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                flat = [item for wave in self.run_case(entry)["waves"] for item in wave]
                self.assertEqual(flat, entry["items"])

    def test_an_item_fails_only_if_scripted_to(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                for result in self.run_case(entry)["results"]:
                    self.assertEqual(result["ok"], result["item"] not in entry["failures"])
