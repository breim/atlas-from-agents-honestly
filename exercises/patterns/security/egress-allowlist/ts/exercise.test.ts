import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Verdict, allowed as Allowed } from './start.ts';

interface Case {
  id: string;
  url: string;
  verdict: Verdict;
}

const fixture = expected<{ chapter: string; allow: string[]; cases: Case[] }>(import.meta.url);
const { allowed } = await loadImpl<{ allowed: typeof Allowed }>(import.meta.url);

const run = (entry: Case) => allowed(entry.url, fixture.allow);

const cases: Array<[string, string]> = [
  ['an-exact-host-is-allowed', 'the allowlisted host goes through'],
  ['a-subdomain-of-a-dotted-entry-is-allowed', 'a dotted entry covers its subdomains'],
  ['a-deeper-subdomain-is-allowed', 'depth does not matter under a dotted entry'],
  ['the-bare-domain-of-a-dotted-entry-is-not-allowed', 'a dotted entry is not the bare domain'],
  ['a-suffix-lookalike-is-refused', 'endsWith on the bare host is the bug'],
  ['an-attacker-controlled-parent-domain-is-refused', 'includes on the host is the other bug'],
  ['a-host-in-userinfo-does-not-count', 'the host is what the parser says it is'],
  ['an-allowlisted-host-over-http-is-refused', 'the right host on the wrong scheme is refused'],
  ['an-unparseable-url-is-refused', 'what cannot be parsed cannot be vouched for'],
  ['matching-is-case-insensitive-on-the-host', 'host casing is not a bypass'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.verdict);
  });
}

test('nothing is ever allowed over a scheme other than https', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    assert.ok(entry.url.toLowerCase().startsWith('https://'), `${entry.id}: allowed non-https`);
  }
});

test('an empty allowlist allows nothing', () => {
  for (const entry of fixture.cases) {
    assert.equal(allowed(entry.url, []).allowed, false, `${entry.id}: allowed with no allowlist`);
  }
});

test('a hostile host is refused however it is dressed up', () => {
  const hostile = [
    'https://attacker.net/',
    'https://api.meridian.example.attacker.net/',
    'https://evil-api.meridian.example/',
    'https://api.meridian.example@attacker.net/',
    'https://xapi.meridian.example/',
    'https://internal.example.attacker.net/',
  ];
  for (const url of hostile) {
    assert.equal(allowed(url, fixture.allow).allowed, false, `${url} slipped through`);
  }
});

test('a denial always names a reason and an allowance never does', () => {
  for (const entry of fixture.cases) {
    const { allowed: ok, reason } = run(entry);
    if (ok) assert.equal(reason, null, `${entry.id}`);
    else assert.ok(reason, `${entry.id}: refused without a reason`);
  }
});
