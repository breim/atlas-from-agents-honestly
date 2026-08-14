import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Recording, Replayed, Serving, replay as Replay } from './start.ts';

interface Case {
  id: string;
  serving?: Serving;
  recording: Recording;
  requests: string[];
  result: Replayed;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { replay } = await loadImpl<{ replay: typeof Replay }>(import.meta.url);

const configFor = (entry: Case, overrides: Partial<Config> = {}): Config => ({
  ...fixture.config,
  ...(entry.serving ? { serving: entry.serving } : {}),
  ...overrides,
});
const run = (entry: Case, overrides: Partial<Config> = {}) =>
  replay(entry.recording, entry.requests, configFor(entry, overrides));

const cases: Array<[string, string]> = [
  ['an-unchanged-prompt-replays-the-recorded-response', 'the recording stands in for the model'],
  ['a-small-wording-change-still-replays', 'a tolerance, not an equality check'],
  ['a-rebuilt-prompt-is-routed-to-re-run', 'the recorded answer is to a different question'],
  ['a-model-upgrade-makes-every-recording-stale', 'byte-identical prompts, worthless recording'],
  ['changing-the-effort-is-also-stale', 'the other knob, the same problem'],
  ['asking-for-more-calls-than-were-recorded-is-exhausted', 'a call the run never made'],
  ['fewer-calls-than-recorded-is-a-clean-replay', 'the fix short-circuited, and that is fine'],
  ['divergence-stops-at-the-first-bad-step', 'nothing is served past the divergence'],
  ['an-empty-replay-has-nothing-to-check', 'no calls, no recording needed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a different model returns nothing, whatever the prompts', () => {
  for (const entry of fixture.cases) {
    const upgraded = { ...configFor(entry).serving, model: 'some-other-model' };
    const result = run(entry, { serving: upgraded });
    assert.deepEqual(result, { status: 'stale', responses: [], consumed: 0, driftBps: [] }, entry.id);
  }
});

test('a different effort returns nothing, whatever the prompts', () => {
  for (const entry of fixture.cases) {
    const louder = { ...configFor(entry).serving, effort: 'some-other-effort' };
    assert.equal(run(entry, { serving: louder }).status, 'stale', entry.id);
  }
});

test('consumed is exactly how many responses were handed back', () => {
  for (const entry of fixture.cases) {
    const { responses, consumed } = run(entry);
    assert.equal(consumed, responses.length, `${entry.id}: the count disagrees with the answers`);
  }
});

test('every response served is the recorded one at that position', () => {
  for (const entry of fixture.cases) {
    const { responses } = run(entry);
    assert.deepEqual(responses, entry.recording.events.slice(0, responses.length).map((e) => e.response), entry.id);
  }
});

test('drift is zero exactly when the prompt matched the recording', () => {
  for (const entry of fixture.cases) {
    const { driftBps } = run(entry);
    driftBps.forEach((delta, index) => {
      const identical = entry.recording.events[index].prompt === entry.requests[index];
      if (identical) assert.equal(delta, 0, `${entry.id}: identical prompts drifted`);
      else assert.ok(delta > 0, `${entry.id}: different prompts did not drift`);
    });
  }
});

test('nothing is served past a divergence', () => {
  for (const entry of fixture.cases) {
    const { status, consumed, driftBps } = run(entry);
    if (status !== 'diverged') continue;
    assert.equal(consumed, driftBps.length - 1, `${entry.id}: a response was served after the divergence`);
    assert.ok(driftBps[driftBps.length - 1] > fixture.config.thresholdBps, entry.id);
  }
});

test('a wider tolerance never serves fewer responses', () => {
  for (const entry of fixture.cases) {
    const tight = run(entry, { thresholdBps: 0 });
    const wide = run(entry, { thresholdBps: 10000 });
    assert.ok(wide.consumed >= run(entry).consumed, `${entry.id}: tolerance went the wrong way`);
    assert.ok(run(entry).consumed >= tight.consumed, `${entry.id}: tolerance went the wrong way`);
  }
});

test('replaying a recording against its own prompts is always total', () => {
  for (const entry of fixture.cases) {
    const own = entry.recording.events.map((event) => event.prompt);
    const result = replay(entry.recording, own, { ...configFor(entry), serving: entry.recording.serving });
    assert.equal(result.status, 'replayed', `${entry.id}: a recording diverged from itself`);
    assert.deepEqual(result.responses, entry.recording.events.map((event) => event.response), entry.id);
    assert.ok(result.driftBps.every((delta) => delta === 0), `${entry.id}: a recording drifted from itself`);
  }
});

test('drift does not care which side is the recording', () => {
  for (const entry of fixture.cases) {
    const forward = run(entry).driftBps;
    const mirrored = replay(
      { serving: entry.recording.serving, events: entry.requests.map((prompt) => ({ prompt, response: 'x' })) },
      entry.recording.events.map((event) => event.prompt),
      configFor(entry),
    ).driftBps;
    assert.deepEqual(mirrored.slice(0, forward.length), forward, `${entry.id}: drift is not symmetric`);
  }
});
