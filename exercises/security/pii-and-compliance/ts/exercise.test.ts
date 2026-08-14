import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assembled, Field, Store, assemble as Assemble } from './start.ts';

interface Case {
  id: string;
  record?: Field[];
  stores?: Store[];
  result: Assembled;
}

interface Fixture {
  chapter: string;
  vault: Record<string, string>;
  record: Field[];
  stores: Store[];
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { assemble } = await loadImpl<{ assemble: typeof Assemble }>(import.meta.url);

const recordOf = (entry: Case) => entry.record ?? fixture.record;
const storesOf = (entry: Case) => entry.stores ?? fixture.stores;
const run = (entry: Case, record = recordOf(entry), stores = storesOf(entry)) =>
  assemble(record, stores, fixture.vault);
const PERSONAL = ['personal', 'restricted'];

const cases: Array<[string, string]> = [
  ['redacting-at-assembly-keeps-personal-data-out-of-every-copy', 'every copy inherits the reduction'],
  ['redacting-at-the-trace-instead-is-one-step-too-late', 'four stores you cannot delete from'],
  ['a-store-with-a-subject-key-can-honour-the-request', 'a key is what makes deletion possible'],
  ['the-provider-is-the-one-you-cannot-un-send', 'the single irreversible moment'],
  ['a-pseudonym-is-not-personal-data-in-the-prompt', 'a handle the model can carry'],
  ['an-omitted-field-never-leaves-the-vault', 'the reply does not need the address'],
  ['an-internal-field-is-not-personal-data', 'classification is on the field'],
  ['a-raw-store-holds-everything-whatever-the-prompt-said', 'the source of truth still needs deletion'],
  ['an-empty-record-exposes-nothing', 'no fields, no copies'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('one prompt entry per field, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry).prompt.map((f) => f.name), recordOf(entry).map((f) => f.name), entry.id);
  }
});

test('a value only appears in the prompt when the schema said verbatim', () => {
  for (const entry of fixture.cases) {
    const prompt = run(entry).prompt;
    recordOf(entry).forEach((field, index) => {
      const owed =
        field.render === 'verbatim' ? field.value : field.render === 'pseudonym' ? fixture.vault[field.value] : '[redacted]';
      assert.equal(prompt[index].rendered, owed, `${entry.id}: ${field.name}`);
      if (field.render !== 'verbatim') {
        assert.notEqual(prompt[index].rendered, field.value, `${entry.id}: ${field.name} leaked into the prompt`);
      }
    });
  }
});

test('a pseudonymised or omitted field reaches no prompt-fed store', () => {
  for (const entry of fixture.cases) {
    const hidden = recordOf(entry).filter((field) => field.render !== 'verbatim').map((field) => field.name);
    for (const item of run(entry).exposure) {
      const store = storesOf(entry).find((candidate) => candidate.name === item.store)!;
      if (store.receives !== 'prompt') continue;
      for (const name of hidden) {
        assert.ok(!item.personalFields.includes(name), `${entry.id}: ${name} reached ${item.store}`);
      }
    }
  }
});

test('a raw store holds every personal field however the prompt rendered it', () => {
  for (const entry of fixture.cases) {
    const personal = recordOf(entry).filter((f) => PERSONAL.includes(f.sensitivity)).map((f) => f.name);
    for (const item of run(entry).exposure) {
      const store = storesOf(entry).find((candidate) => candidate.name === item.store)!;
      if (store.receives !== 'raw') continue;
      assert.deepEqual(item.personalFields, personal, `${entry.id}: ${item.store}`);
    }
  }
});

test('nothing that is not personal ever counts as exposure', () => {
  for (const entry of fixture.cases) {
    const sensitivity = new Map(recordOf(entry).map((field) => [field.name, field.sensitivity]));
    for (const item of run(entry).exposure) {
      for (const name of item.personalFields) {
        assert.ok(PERSONAL.includes(sensitivity.get(name)!), `${entry.id}: ${name} is not personal`);
      }
    }
  }
});

test('pseudonymising every personal field empties every prompt-fed store', () => {
  for (const entry of fixture.cases) {
    const hidden = recordOf(entry).map((field) =>
      PERSONAL.includes(field.sensitivity) ? { ...field, render: 'pseudonym' as const } : field,
    );
    for (const item of run(entry, hidden).exposure) {
      const store = storesOf(entry).find((candidate) => candidate.name === item.store)!;
      if (store.receives !== 'prompt') continue;
      assert.deepEqual(item.personalFields, [], `${entry.id}: ${item.store} kept something`);
    }
  }
});

test('a store is unerasable exactly when it holds personal data with no subject key', () => {
  for (const entry of fixture.cases) {
    const { exposure, unerasable } = run(entry);
    for (const item of exposure) {
      const store = storesOf(entry).find((candidate) => candidate.name === item.store)!;
      const stranded = item.personalFields.length > 0 && !store.keyedBySubject;
      assert.equal(unerasable.includes(item.store), stranded, `${entry.id}: ${item.store}`);
    }
  }
});

test('giving every store a subject key makes the request answerable', () => {
  for (const entry of fixture.cases) {
    const keyed = storesOf(entry).map((store) => ({ ...store, keyedBySubject: true }));
    assert.deepEqual(run(entry, recordOf(entry), keyed).unerasable, [], entry.id);
  }
});

test('redacting later never reduces what an earlier copy already holds', () => {
  for (const entry of fixture.cases) {
    const verbatim = recordOf(entry).map((field) =>
      PERSONAL.includes(field.sensitivity) ? { ...field, render: 'verbatim' as const } : field,
    );
    const before = run(entry);
    const after = run(entry, verbatim);
    for (const [index, item] of after.exposure.entries()) {
      assert.ok(item.personalFields.length >= before.exposure[index].personalFields.length, entry.id);
    }
  }
});
