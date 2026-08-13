import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Watch, watch as WatchFn } from './start.ts';

interface Case {
  id: string;
  outcomes: string[];
  result: Watch;
}

const fixture = expected<{ chapter: string; window: number; floorBps: number; cases: Case[] }>(
  import.meta.url,
);
const { watch } = await loadImpl<{ watch: typeof WatchFn }>(import.meta.url);

const run = (entry: Case) => watch(entry.outcomes, fixture.window, fixture.floorBps);

const cases: Array<[string, string]> = [
  ['a-healthy-stream-never-trips', 'healthy traffic is left alone'],
  ['a-partial-window-never-trips', 'the first requests are not a signal'],
  ['a-full-window-below-the-floor-trips', 'a bad full window fires'],
  ['exactly-at-the-floor-does-not-trip', 'the floor comparison is strict'],
  ['an-old-failure-rolls-out-of-the-window', 'the window rolls rather than accumulates'],
  ['the-guardrail-trips-at-the-first-bad-window-and-stops-looking', 'the first breach is the breach'],
  ['a-recovery-after-tripping-is-still-a-trip', 'a fired guardrail does not un-fire'],
  ['no-traffic-never-trips', 'no traffic is no judgement'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a stream shorter than the window never trips', () => {
  for (const entry of fixture.cases) {
    const short = entry.outcomes.slice(0, fixture.window - 1);
    const result = watch(short, fixture.window, fixture.floorBps);
    assert.equal(result.tripped, false, `${entry.id}: tripped on a partial window`);
    assert.equal(result.worstBps, null, `${entry.id}: scored a window that was never full`);
  }
});

test('the trip index always names a full window that was under the floor', () => {
  for (const entry of fixture.cases) {
    const { tripped, at } = run(entry);
    if (!tripped) continue;
    assert.ok(at! >= fixture.window - 1, `${entry.id}: tripped before a window could fill`);
    const slice = entry.outcomes.slice(at! - fixture.window + 1, at! + 1);
    const bps = (slice.filter((outcome) => outcome === 'ok').length * 10000) / fixture.window;
    assert.ok(bps < fixture.floorBps, `${entry.id}: tripped on a window at ${bps}`);
  }
});

test('no window before the trip was under the floor', () => {
  for (const entry of fixture.cases) {
    const { tripped, at } = run(entry);
    const last = tripped ? at! : entry.outcomes.length - 1;
    for (let end = fixture.window - 1; end < last; end += 1) {
      const slice = entry.outcomes.slice(end - fixture.window + 1, end + 1);
      const bps = (slice.filter((outcome) => outcome === 'ok').length * 10000) / fixture.window;
      assert.ok(bps >= fixture.floorBps, `${entry.id}: missed an earlier breach at ${end}`);
    }
  }
});

test('a lower floor never trips more often', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).tripped) continue;
    const lenient = watch(entry.outcomes, fixture.window, 0);
    assert.equal(lenient.tripped, false, `${entry.id}: tripped against a floor of zero`);
  }
});
