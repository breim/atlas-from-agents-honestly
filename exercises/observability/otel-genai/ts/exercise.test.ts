import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Collected, Config, Span, collect as Collect } from './start.ts';

interface Case {
  id: string;
  captureContent?: boolean;
  providerTokens: number;
  spans: Span[];
  result: Collected;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { collect } = await loadImpl<{ collect: typeof Collect }>(import.meta.url);

const configFor = (entry: Case, overrides: Partial<Config> = {}): Config => ({
  ...fixture.config,
  ...(entry.captureContent === undefined ? {} : { captureContent: entry.captureContent }),
  ...overrides,
});
const run = (entry: Case, overrides: Partial<Config> = {}) =>
  collect(entry.spans, configFor(entry, overrides), entry.providerTokens);
const owned = (entry: Case) => entry.spans.filter((span) => span.emitter === fixture.config.owners[span.type]);

const cases: Array<[string, string]> = [
  ['a-clean-trace-keeps-every-span', 'one owner each, nothing to reconcile'],
  ['a-second-library-wrapping-the-model-call-is-dropped', 'the extra span that doubles your bill'],
  ['a-model-span-nobody-emitted-shows-up-as-a-mismatch', 'the ten-minute check earning its keep'],
  ['content-is-not-captured-by-default', 'the payloads do not belong in the backend'],
  ['turning-capture-on-keeps-the-payloads', 'and it is a decision, not an accident'],
  ['an-invented-convention-key-is-a-violation', 'overloading gen_ai is not portable'],
  ['the-same-fact-in-your-own-namespace-is-fine', 'the identical field, correctly placed'],
  ['a-key-in-nobody-namespace-is-a-violation', 'a bare key belongs to nobody'],
  ['a-dropped-span-is-not-your-problem', 'discarded means not inspected'],
  ['an-empty-trace-has-nothing-to-check', 'no spans, no trace'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every span is either kept or dropped, exactly once', () => {
  for (const entry of fixture.cases) {
    const { kept, dropped } = run(entry);
    assert.deepEqual([...kept, ...dropped].sort(), entry.spans.map((span) => span.id).sort(), entry.id);
  }
});

test('a span is kept exactly when its emitter owns that span type', () => {
  for (const entry of fixture.cases) {
    const { kept } = run(entry);
    for (const span of entry.spans) {
      const owns = span.emitter === fixture.config.owners[span.type];
      assert.equal(kept.includes(span.id), owns, `${entry.id}: ${span.id} from ${span.emitter}`);
    }
  }
});

test('tokens are summed over kept spans only', () => {
  for (const entry of fixture.cases) {
    const total = owned(entry).reduce(
      (sum, span) =>
        sum +
        Number(span.attributes['gen_ai.usage.input_tokens'] ?? 0) +
        Number(span.attributes['gen_ai.usage.output_tokens'] ?? 0),
      0,
    );
    assert.equal(run(entry).tokens, total, `${entry.id}: a dropped span was billed`);
  }
});

const usage = (span: Span) =>
  Number(span.attributes['gen_ai.usage.input_tokens'] ?? 0) +
  Number(span.attributes['gen_ai.usage.output_tokens'] ?? 0);

test('keeping the duplicates would have broken the provider check', () => {
  for (const entry of fixture.cases) {
    const before = run(entry);
    const naive = entry.spans.reduce((sum, span) => sum + usage(span), 0);
    const doubled = entry.spans.filter((span) => before.dropped.includes(span.id)).reduce((s, x) => s + usage(x), 0);
    assert.equal(naive, before.tokens + doubled, `${entry.id}: the accounting does not split`);
    if (doubled === 0 || !before.tokensMatchProvider) continue;
    assert.notEqual(naive, entry.providerTokens, `${entry.id}: the double count went unnoticed`);
  }
});

test('a violation is only ever raised against a span that was kept', () => {
  for (const entry of fixture.cases) {
    const { kept, violations } = run(entry);
    for (const violation of violations) {
      assert.ok(kept.includes(violation.split(':')[0]), `${entry.id}: ${violation} came from a dropped span`);
    }
  }
});

test('a key is a violation exactly when it is neither a convention nor yours', () => {
  for (const entry of fixture.cases) {
    const { violations } = run(entry);
    for (const span of owned(entry)) {
      for (const key of Object.keys(span.attributes)) {
        const conventional = key.startsWith('gen_ai.') && fixture.config.conventionKeys.includes(key);
        const ours = key.startsWith(`${fixture.config.namespace}.`);
        const flagged = violations.some((violation) => violation.endsWith(`:${key}`) && violation.startsWith(`${span.id}:`));
        assert.equal(flagged, !conventional && !ours, `${entry.id}: ${span.id}/${key}`);
      }
    }
  }
});

test('moving a rejected key into your namespace clears the violation', () => {
  for (const entry of fixture.cases) {
    if (run(entry).violations.length === 0) continue;
    const renamed = entry.spans.map((span) => ({
      ...span,
      attributes: Object.fromEntries(
        Object.entries(span.attributes).map(([key, value]) => [
          fixture.config.conventionKeys.includes(key) ? key : `${fixture.config.namespace}.${key}`,
          value,
        ]),
      ),
    }));
    assert.deepEqual(collect(renamed, configFor(entry), entry.providerTokens).violations, [], entry.id);
  }
});

test('a span is redacted exactly when it carries content and capture is off', () => {
  for (const entry of fixture.cases) {
    for (const capture of [false, true]) {
      const { redacted } = run(entry, { captureContent: capture });
      for (const span of owned(entry)) {
        const carries = Object.keys(span.attributes).some((key) => fixture.config.contentKeys.includes(key));
        assert.equal(redacted.includes(span.id), carries && !capture, `${entry.id}/${capture}: ${span.id}`);
      }
    }
  }
});

test('capturing content changes nothing about tokens or violations', () => {
  for (const entry of fixture.cases) {
    const off = run(entry, { captureContent: false });
    const on = run(entry, { captureContent: true });
    assert.equal(on.tokens, off.tokens, `${entry.id}: capture moved the token count`);
    assert.deepEqual(on.violations, off.violations, `${entry.id}: capture moved the violations`);
    assert.deepEqual(on.kept, off.kept, entry.id);
  }
});
