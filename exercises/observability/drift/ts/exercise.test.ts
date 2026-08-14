import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Diagnosis, Thresholds, Window, diagnose as Diagnose } from './start.ts';

interface Case {
  id: string;
  window: Window;
  result: Diagnosis;
}

const fixture = expected<{ chapter: string; thresholds: Thresholds; cases: Case[] }>(import.meta.url);
const { diagnose } = await loadImpl<{ diagnose: typeof Diagnose }>(import.meta.url);

const run = (window: Window, thresholds = fixture.thresholds) => diagnose(window, thresholds);
const quiet: Window = {
  deployed: false,
  canaryScoreDeltaBps: 0,
  citedChunkTurnoverBps: 0,
  inputCentroidShiftBps: 0,
  evalScoreDeltaBps: 0,
  formatComplianceDeltaBps: 0,
};

const cases: Array<[string, string]> = [
  ['a-quiet-window-diagnoses-nothing', 'nothing moved, nothing to route'],
  ['the-deploy-log-comes-first', 'everything is screaming and you still did it'],
  ['a-frozen-canary-that-moved-is-the-provider', 'the only variable left'],
  ['input-drift-alone-is-not-an-alert', 'traffic changes every week and it is fine'],
  ['an-eval-drop-alone-is-not-an-alert', 'noisy on a small sample'],
  ['the-pair-is-the-alert', 'the conjunction has the low base rate'],
  ['a-re-index-displaced-the-chunk-that-answered-the-question', 'the real culprit, usually'],
  ['format-compliance-is-the-cheapest-model-tell', 'shape moves before quality does'],
  ['a-canary-drop-outranks-a-format-drop', 'diagnose the cause, not the symptom'],
  ['a-threshold-reached-exactly-is-reached', 'the boundary is inclusive'],
  ['getting-better-is-not-drift', 'the deltas are signed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.window), entry.result);
  });
}

test('a deploy in the window outranks every other signal', () => {
  for (const entry of fixture.cases) {
    const shipped = run({ ...entry.window, deployed: true });
    assert.equal(shipped.cause, 'check_the_deploy_log', `${entry.id}: the deploy log was not checked first`);
    assert.ok(shipped.tripped.includes('deploy'), entry.id);
  }
});

test('a cause is never reported without a signal behind it', () => {
  for (const entry of fixture.cases) {
    const { cause, tripped } = run(entry.window);
    if (cause === null) continue;
    assert.ok(tripped.length > 0, `${entry.id}: ${cause} came from nowhere`);
  }
});

test('tripped names exactly the signals past their thresholds', () => {
  const t = fixture.thresholds;
  for (const entry of fixture.cases) {
    const w = entry.window;
    const owed = [
      w.deployed && 'deploy',
      w.canaryScoreDeltaBps <= -t.canaryDropBps && 'canary',
      w.citedChunkTurnoverBps >= t.chunkTurnoverBps && 'chunk_turnover',
      w.inputCentroidShiftBps >= t.centroidShiftBps && 'input_centroid',
      w.evalScoreDeltaBps <= -t.evalDropBps && 'eval_score',
      w.formatComplianceDeltaBps <= -t.formatDropBps && 'format_compliance',
    ].filter(Boolean);
    assert.deepEqual(run(w).tripped, owed, entry.id);
  }
});

test('input drift on its own never raises a cause', () => {
  for (const shift of [1500, 2500, 9999]) {
    const { cause, tripped } = run({ ...quiet, inputCentroidShiftBps: shift });
    assert.equal(cause, null, `centroid ${shift}: drifting traffic paged somebody`);
    assert.deepEqual(tripped, ['input_centroid']);
  }
});

test('the joint alert needs both halves', () => {
  for (const entry of fixture.cases) {
    if (run(entry.window).cause !== 'input_distribution_changed') continue;
    const half = run({ ...entry.window, inputCentroidShiftBps: 0 });
    assert.notEqual(half.cause, 'input_distribution_changed', `${entry.id}: one half was enough`);
    const other = run({ ...entry.window, evalScoreDeltaBps: 0 });
    assert.notEqual(other.cause, 'input_distribution_changed', `${entry.id}: one half was enough`);
  }
});

test('an improvement in any signal never trips it', () => {
  for (const entry of fixture.cases) {
    const better: Window = {
      ...entry.window,
      canaryScoreDeltaBps: Math.abs(entry.window.canaryScoreDeltaBps),
      evalScoreDeltaBps: Math.abs(entry.window.evalScoreDeltaBps),
      formatComplianceDeltaBps: Math.abs(entry.window.formatComplianceDeltaBps),
    };
    const { tripped } = run(better);
    for (const name of ['canary', 'eval_score', 'format_compliance']) {
      assert.ok(!tripped.includes(name), `${entry.id}: ${name} tripped on an improvement`);
    }
  }
});

test('raising a threshold never adds a trip', () => {
  for (const entry of fixture.cases) {
    const relaxed: Thresholds = {
      canaryDropBps: 100000,
      chunkTurnoverBps: 100000,
      centroidShiftBps: 100000,
      evalDropBps: 100000,
      formatDropBps: 100000,
    };
    const loose = run(entry.window, relaxed).tripped;
    const tight = run(entry.window).tripped;
    for (const name of loose) assert.ok(tight.includes(name), `${entry.id}: ${name} appeared when relaxed`);
  }
});

test('a moved canary outranks everything except the deploy log', () => {
  for (const entry of fixture.cases) {
    const upstream = run({ ...entry.window, deployed: false, canaryScoreDeltaBps: -100000 });
    assert.equal(upstream.cause, 'provider_behavior_changed', `${entry.id}: the canary was outranked`);
  }
});
