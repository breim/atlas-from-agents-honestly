import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)
VAULT = FIXTURE["vault"]
PERSONAL = ("personal", "restricted")

CASES = (
    (
        "redacting-at-assembly-keeps-personal-data-out-of-every-copy",
        "every copy inherits the reduction",
    ),
    (
        "redacting-at-the-trace-instead-is-one-step-too-late",
        "four stores you cannot delete from",
    ),
    (
        "a-store-with-a-subject-key-can-honour-the-request",
        "a key is what makes deletion possible",
    ),
    ("the-provider-is-the-one-you-cannot-un-send", "the single irreversible moment"),
    ("a-pseudonym-is-not-personal-data-in-the-prompt", "a handle the model can carry"),
    ("an-omitted-field-never-leaves-the-vault", "the reply does not need the address"),
    ("an-internal-field-is-not-personal-data", "classification is on the field"),
    (
        "a-raw-store-holds-everything-whatever-the-prompt-said",
        "the source of truth still needs deletion",
    ),
    ("an-empty-record-exposes-nothing", "no fields, no copies"),
)


class PiiAndCompliance(unittest.TestCase):
    def setUp(self):
        self.assemble = load_impl(__file__).assemble

    @staticmethod
    def record_of(entry: dict) -> list:
        return entry.get("record", FIXTURE["record"])

    @staticmethod
    def stores_of(entry: dict) -> list:
        return entry.get("stores", FIXTURE["stores"])

    def run_case(self, entry: dict, record: list = None, stores: list = None) -> dict:
        return self.assemble(
            self.record_of(entry) if record is None else record,
            self.stores_of(entry) if stores is None else stores,
            VAULT,
        )

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["result"])

    def test_one_prompt_entry_per_field_in_order(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                prompt = self.run_case(entry)["prompt"]
                self.assertEqual(
                    [p["name"] for p in prompt],
                    [f["name"] for f in self.record_of(entry)],
                )

    def test_a_value_appears_only_when_the_schema_said_verbatim(self):
        for entry in FIXTURE["cases"]:
            prompt = self.run_case(entry)["prompt"]
            for index, field in enumerate(self.record_of(entry)):
                with self.subTest(f"{entry['id']}:{field['name']}"):
                    if field["render"] == "verbatim":
                        owed = field["value"]
                    elif field["render"] == "pseudonym":
                        owed = VAULT[field["value"]]
                    else:
                        owed = "[redacted]"
                    self.assertEqual(prompt[index]["rendered"], owed)
                    if field["render"] != "verbatim":
                        self.assertNotEqual(prompt[index]["rendered"], field["value"])

    def test_a_hidden_field_reaches_no_prompt_fed_store(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                hidden = [
                    f["name"] for f in self.record_of(entry) if f["render"] != "verbatim"
                ]
                stores = {s["name"]: s for s in self.stores_of(entry)}
                for item in self.run_case(entry)["exposure"]:
                    if stores[item["store"]]["receives"] != "prompt":
                        continue
                    for name in hidden:
                        self.assertNotIn(name, item["personalFields"])

    def test_a_raw_store_holds_every_personal_field(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                personal = [
                    f["name"]
                    for f in self.record_of(entry)
                    if f["sensitivity"] in PERSONAL
                ]
                stores = {s["name"]: s for s in self.stores_of(entry)}
                for item in self.run_case(entry)["exposure"]:
                    if stores[item["store"]]["receives"] != "raw":
                        continue
                    self.assertEqual(item["personalFields"], personal)

    def test_nothing_that_is_not_personal_counts_as_exposure(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                sensitivity = {
                    f["name"]: f["sensitivity"] for f in self.record_of(entry)
                }
                for item in self.run_case(entry)["exposure"]:
                    for name in item["personalFields"]:
                        self.assertIn(sensitivity[name], PERSONAL)

    def test_pseudonymising_everything_empties_every_prompt_fed_store(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                hidden = [
                    {**f, "render": "pseudonym"} if f["sensitivity"] in PERSONAL else f
                    for f in self.record_of(entry)
                ]
                stores = {s["name"]: s for s in self.stores_of(entry)}
                for item in self.run_case(entry, record=hidden)["exposure"]:
                    if stores[item["store"]]["receives"] != "prompt":
                        continue
                    self.assertEqual(item["personalFields"], [])

    def test_a_store_is_unerasable_exactly_when_it_holds_personal_data_unkeyed(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                result = self.run_case(entry)
                stores = {s["name"]: s for s in self.stores_of(entry)}
                for item in result["exposure"]:
                    stranded = bool(item["personalFields"]) and not stores[
                        item["store"]
                    ]["keyedBySubject"]
                    self.assertEqual(item["store"] in result["unerasable"], stranded)

    def test_giving_every_store_a_subject_key_makes_the_request_answerable(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                keyed = [
                    {**s, "keyedBySubject": True} for s in self.stores_of(entry)
                ]
                self.assertEqual(self.run_case(entry, stores=keyed)["unerasable"], [])

    def test_redacting_later_never_reduces_what_a_copy_already_holds(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verbatim = [
                    {**f, "render": "verbatim"} if f["sensitivity"] in PERSONAL else f
                    for f in self.record_of(entry)
                ]
                before = self.run_case(entry)
                after = self.run_case(entry, record=verbatim)
                for index, item in enumerate(after["exposure"]):
                    self.assertGreaterEqual(
                        len(item["personalFields"]),
                        len(before["exposure"][index]["personalFields"]),
                    )
