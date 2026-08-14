import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Path, Read, Tool, Verdict, assess as Assess } from './start.ts';

interface Case {
  id: string;
  path: Path;
  result: Verdict;
}

interface Fixture {
  chapter: string;
  config: Config;
  catalogue: Record<string, Tool>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { assess } = await loadImpl<{ assess: typeof Assess }>(import.meta.url);

const run = (path: Path) => assess(path, fixture.catalogue, fixture.config);
const toolOf = (path: Path) => fixture.catalogue[path.call.tool];

const cases: Array<[string, string]> = [
  ['a-read-on-a-clean-run-is-admitted', 'nothing untrusted has arrived'],
  ['reading-a-ticket-body-taints-the-run', 'because of where the bytes came from'],
  ['a-scoped-credit-on-a-tainted-run-is-admitted', 'this ticket, this order, tier zero'],
  ['the-same-tool-pointed-at-another-account-is-not', 'ticket #9104, stopped at the dispatcher'],
  ['the-right-order-for-the-wrong-amount-is-not-scoped', 'blast radius lives in the arguments'],
  ['all-three-present-and-the-path-is-still-safe', 'the vector was narrowed, not removed'],
  ['a-model-authored-recipient-is-refused', 'this is where the trifecta breaks'],
  ['an-untainted-run-still-cannot-invent-a-recipient', 'a control, not a response to taint'],
  ['a-later-trusted-read-does-not-clear-the-taint', 'there is no un-taint path'],
  ['a-path-with-nothing-private-is-not-lethal', 'two of three is survivable'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.path), entry.result);
  });
}

test('taint is exactly whether any read came from an untrusted source', () => {
  for (const entry of fixture.cases) {
    const untrusted = entry.path.reads.filter((read) => read.trust === 'untrusted');
    const { tainted, sources } = run(entry.path);
    assert.equal(tainted, untrusted.length > 0, entry.id);
    assert.deepEqual(sources, untrusted.map((read) => read.source), `${entry.id}: the trace lost a source`);
  }
});

test('appending any read never clears the taint', () => {
  for (const entry of fixture.cases) {
    if (!run(entry.path).tainted) continue;
    for (const trust of ['trusted', 'untrusted'] as const) {
      const later: Read = { source: 'later-read', trust, private: false };
      const after = run({ ...entry.path, reads: [...entry.path.reads, later] });
      assert.equal(after.tainted, true, `${entry.id}: a ${trust} read cleared the taint`);
      assert.deepEqual(after.sources.slice(0, run(entry.path).sources.length), run(entry.path).sources, entry.id);
    }
  }
});

test('an innocent untrusted read taints exactly as a hostile one would', () => {
  for (const entry of fixture.cases) {
    const renamed = entry.path.reads.map((read) => ({ ...read, source: `${read.source}-benign` }));
    const after = run({ ...entry.path, reads: renamed });
    assert.equal(after.tainted, run(entry.path).tainted, `${entry.id}: taint depended on the content`);
    assert.equal(after.admitted, run(entry.path).admitted, entry.id);
  }
});

test('lethal is exactly all three legs of the trifecta', () => {
  for (const entry of fixture.cases) {
    const { trifecta, lethal } = run(entry.path);
    assert.equal(lethal, trifecta.privateData && trifecta.untrustedContent && trifecta.exfiltration, entry.id);
    assert.equal(trifecta.exfiltration, toolOf(entry.path).exfiltrates, entry.id);
    assert.equal(trifecta.privateData, entry.path.reads.some((read) => read.private), entry.id);
  }
});

test('being lethal is a review signal, never a denial on its own', () => {
  for (const entry of fixture.cases) {
    const { lethal, admitted, reason } = run(entry.path);
    if (!lethal || !admitted) continue;
    assert.equal(reason, null, `${entry.id}: an admitted lethal path carried a reason`);
  }
});

test('an exfiltrating call is refused whenever the recipient is not on the record', () => {
  for (const entry of fixture.cases) {
    if (!toolOf(entry.path).exfiltrates) continue;
    const forged = { ...entry.path, call: { ...entry.path.call, recipient: 'somewhere@else.example' } };
    const result = run(forged);
    assert.equal(result.admitted, false, `${entry.id}: a model-authored address went out`);
    assert.equal(result.reason, 'recipient_not_from_record', entry.id);
  }
});

test('a tainted run below the ceiling is admitted whatever the arguments say', () => {
  for (const entry of fixture.cases) {
    for (const [name, tool] of Object.entries(fixture.catalogue)) {
      if (tool.class > fixture.config.maxClassWhenTainted || tool.exfiltrates) continue;
      const low = { ...entry.path, call: { ...entry.path.call, tool: name, orderId: 'anything', amountCents: 9_999_999 } };
      assert.equal(run(low).admitted, true, `${entry.id}: class ${tool.class} was blocked`);
    }
  }
});

test('above the ceiling a tainted run needs this ticket order and the tier-zero cap', () => {
  for (const entry of fixture.cases) {
    const { tainted } = run(entry.path);
    const tool = toolOf(entry.path);
    if (!tainted || tool.class <= fixture.config.maxClassWhenTainted || tool.exfiltrates) continue;
    for (const call of [
      { orderId: 'somewhere-else', amountCents: 1 },
      { orderId: entry.path.ticket.orderId, amountCents: fixture.config.tier0CapCents + 1 },
    ]) {
      const wide = run({ ...entry.path, call: { ...entry.path.call, ...call } });
      assert.equal(wide.admitted, false, `${entry.id}: ${JSON.stringify(call)} got through`);
      assert.equal(wide.reason, 'class_above_taint_ceiling', entry.id);
    }
  }
});

test('a denial always escalates and always carries its sources', () => {
  for (const entry of fixture.cases) {
    const { admitted, reason, escalate, sources, tainted } = run(entry.path);
    assert.equal(escalate, !admitted, `${entry.id}: a denial did not become a question`);
    assert.equal(reason === null, admitted, entry.id);
    if (!admitted && tainted) assert.ok(sources.length > 0, `${entry.id}: nobody can answer this at 3am`);
  }
});

test('an untainted run is never refused for reading something', () => {
  for (const entry of fixture.cases) {
    const clean = entry.path.reads.map((read) => ({ ...read, trust: 'trusted' as const }));
    const result = run({ ...entry.path, reads: clean });
    if (toolOf(entry.path).exfiltrates && entry.path.call.recipient !== entry.path.ticket.customerEmail) continue;
    assert.equal(result.admitted, true, `${entry.id}: a clean run was held to the taint ceiling`);
  }
});
