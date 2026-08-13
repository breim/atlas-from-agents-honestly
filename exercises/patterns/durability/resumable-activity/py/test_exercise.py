import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("a-fresh-attempt-starts-at-the-beginning", "no checkpoint means all the work"),
    ("a-retry-resumes-after-the-checkpoint", "the checkpointed item is not redone"),
    ("a-failure-checkpoints-what-completed", "the mark is the last success, not the failure"),
    ("a-retry-after-a-failure-finishes-the-work", "the second attempt completes the batch"),
    ("no-item-is-ever-processed-twice", "a finished batch retries into no work"),
    ("failing-on-the-first-item-keeps-the-old-checkpoint", "no progress means no new mark"),
    ("an-unknown-checkpoint-restarts-from-the-beginning", "an unrecognised mark reprocesses"),
    ("no-items-is-a-success-with-no-work", "an empty batch succeeds"),
)


class ResumableActivity(unittest.TestCase):
    def setUp(self):
        self.process = load_impl(__file__).process

    def run_case(self, entry: dict) -> dict:
        return self.process(entry["items"], entry["checkpoint"], entry["failAt"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_nothing_at_or_before_the_checkpoint_is_reprocessed(self):
        for entry in FIXTURE["cases"]:
            if entry["checkpoint"] not in entry["items"]:
                continue
            with self.subTest(entry["id"]):
                cut = entry["items"].index(entry["checkpoint"])
                processed = self.run_case(entry)["processed"]
                for item in entry["items"][: cut + 1]:
                    self.assertNotIn(item, processed)

    def test_the_returned_checkpoint_is_the_last_completed_item(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if not result["processed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertEqual(result["checkpoint"], result["processed"][-1])

    def test_a_failed_attempt_never_marks_the_item_that_failed(self):
        for entry in FIXTURE["cases"]:
            result = self.run_case(entry)
            if result["ok"]:
                continue
            with self.subTest(entry["id"]):
                self.assertNotEqual(result["checkpoint"], entry["failAt"])
                self.assertNotIn(entry["failAt"], result["processed"])

    def test_two_attempts_together_process_each_item_once(self):
        for entry in FIXTURE["cases"]:
            first = self.run_case(entry)
            if first["ok"]:
                continue
            with self.subTest(entry["id"]):
                second = self.process(entry["items"], first["checkpoint"], None)
                start = (
                    0
                    if entry["checkpoint"] not in entry["items"]
                    else entry["items"].index(entry["checkpoint"]) + 1
                )
                self.assertEqual(
                    first["processed"] + second["processed"], entry["items"][start:]
                )
