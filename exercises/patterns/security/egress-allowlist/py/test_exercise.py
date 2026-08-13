import unittest

from atlas.harness import case, expected, load_impl

FIXTURE = expected(__file__)

CASES = (
    ("an-exact-host-is-allowed", "the allowlisted host goes through"),
    ("a-subdomain-of-a-dotted-entry-is-allowed", "a dotted entry covers its subdomains"),
    ("a-deeper-subdomain-is-allowed", "depth does not matter under a dotted entry"),
    ("the-bare-domain-of-a-dotted-entry-is-not-allowed", "a dotted entry is not the bare domain"),
    ("a-suffix-lookalike-is-refused", "endswith on the bare host is the bug"),
    ("an-attacker-controlled-parent-domain-is-refused", "substring matching is the other bug"),
    ("a-host-in-userinfo-does-not-count", "the host is what the parser says it is"),
    ("an-allowlisted-host-over-http-is-refused", "the right host on the wrong scheme is refused"),
    ("an-unparseable-url-is-refused", "what cannot be parsed cannot be vouched for"),
    ("matching-is-case-insensitive-on-the-host", "host casing is not a bypass"),
)

HOSTILE = (
    "https://attacker.net/",
    "https://api.meridian.example.attacker.net/",
    "https://evil-api.meridian.example/",
    "https://api.meridian.example@attacker.net/",
    "https://xapi.meridian.example/",
    "https://internal.example.attacker.net/",
)


class EgressAllowlist(unittest.TestCase):
    def setUp(self):
        self.allowed = load_impl(__file__).allowed

    def run_case(self, entry: dict) -> dict:
        return self.allowed(entry["url"], FIXTURE["allow"])

    def test_each_case_matches_the_shared_fixture(self):
        for case_id, title in CASES:
            entry = case(FIXTURE, case_id)
            with self.subTest(title):
                self.assertEqual(self.run_case(entry), entry["verdict"])

    def test_nothing_is_allowed_over_a_scheme_other_than_https(self):
        for entry in FIXTURE["cases"]:
            if not self.run_case(entry)["allowed"]:
                continue
            with self.subTest(entry["id"]):
                self.assertTrue(entry["url"].lower().startswith("https://"))

    def test_an_empty_allowlist_allows_nothing(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                self.assertFalse(self.allowed(entry["url"], [])["allowed"])

    def test_a_hostile_host_is_refused_however_dressed_up(self):
        for url in HOSTILE:
            with self.subTest(url):
                self.assertFalse(self.allowed(url, FIXTURE["allow"])["allowed"])

    def test_a_denial_always_names_a_reason(self):
        for entry in FIXTURE["cases"]:
            with self.subTest(entry["id"]):
                verdict = self.run_case(entry)
                if verdict["allowed"]:
                    self.assertIsNone(verdict["reason"])
                else:
                    self.assertTrue(verdict["reason"])
