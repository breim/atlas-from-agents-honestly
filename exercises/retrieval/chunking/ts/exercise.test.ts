import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Block, Chunked, Config, Document, chunk as ChunkFn } from './start.ts';

interface Case {
  id: string;
  document: string;
  strategy: Config['strategy'];
  result: Chunked;
}

interface Question {
  id: string;
  document: string;
  matchingBlock: string;
  requiresBlocks: string[];
}

interface Fixture {
  chapter: string;
  config: Config;
  documents: Record<string, Document>;
  questions: Question[];
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { chunk } = await loadImpl<{ chunk: typeof ChunkFn }>(import.meta.url);

const go = (name: string, strategy: Config['strategy']) =>
  chunk(fixture.documents[name], { ...fixture.config, strategy });

const blocksOf = (name: string) => fixture.documents[name].blocks;
const blockOf = (name: string, id: string) => blocksOf(name).find((block) => block.id === id) as Block;

const STRATEGIES: Array<Config['strategy']> = ['structural', 'fixed'];
const DOCUMENTS = Object.keys(fixture.documents);

const cases: Array<[string, string]> = [
  ['structural-splitting-keeps-a-rule-with-its-exception', 'the cut that never happens'],
  ['fixed-size-splitting-cuts-the-rule-from-its-exception', 'the bug you will not see in a metric'],
  ['a-table-is-one-chunk-however-large', 'atomic, or it is noise'],
  ['a-document-with-no-headings-still-produces-one-parent', 'transcripts have nothing to split on'],
  ['an-empty-document-produces-nothing', 'no blocks, no chunks'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry.document, entry.strategy), entry.result);
  });
}

test('the child that matches does not answer, but its parent does', () => {
  for (const question of fixture.questions) {
    const fixed = go(question.document, 'fixed');
    const child = fixed.children.find((item) => item.blockIds.includes(question.matchingBlock));
    assert.ok(child, `${question.id}: nothing indexed the matching block`);

    // The retrieval eval passes: the right chunk was returned. The answer is still wrong.
    const missing = question.requiresBlocks.filter((id) => !child.blockIds.includes(id));
    assert.ok(missing.length > 0, `${question.id}: fixed-size splitting no longer severs anything`);

    const parent = fixed.parents.find((item) => item.id === child.parentId);
    assert.ok(parent, `${question.id}: the child had no parent to return`);
    for (const id of question.requiresBlocks) {
      assert.ok(parent.blockIds.includes(id), `${question.id}: the parent could not answer either`);
    }
  }
});

test('structural splitting leaves every child answerable on its own', () => {
  for (const question of fixture.questions) {
    const child = go(question.document, 'structural').children.find((item) =>
      item.blockIds.includes(question.matchingBlock),
    );
    assert.ok(child, `${question.id}: nothing indexed the matching block`);
    for (const id of question.requiresBlocks) {
      assert.ok(child.blockIds.includes(id), `${question.id}: ${id} was cut away from ${question.matchingBlock}`);
    }
  }
});

test('no child ever begins with a block that cannot stand first', () => {
  for (const name of DOCUMENTS) {
    for (const child of go(name, 'structural').children) {
      const first = blockOf(name, child.blockIds[0]);
      assert.ok(
        !fixture.config.neverStartsAChunk.includes(first.kind),
        `${name}: child ${child.id} begins with a ${first.kind}`,
      );
    }
  }
});

test('a chunk goes over its cap rather than make a cut it must not make', () => {
  const entry = findCase<Case>(fixture, 'structural-splitting-keeps-a-rule-with-its-exception');
  const over = go(entry.document, 'structural').children.filter(
    (child) => child.tokens > fixture.config.maxChildTokens,
  );
  assert.ok(over.length > 0, 'the fixture no longer forces the cap to yield');
  for (const child of over) {
    const heldBack = child.blockIds.slice(1).some((id) => fixture.config.neverStartsAChunk.includes(blockOf(entry.document, id).kind));
    const atomic = child.blockIds.length === 1;
    assert.ok(heldBack || atomic, `child ${child.id} ran over the cap for no reason`);
  }
});

test('every block appears in exactly one child, or is a heading', () => {
  for (const name of DOCUMENTS) {
    for (const strategy of STRATEGIES) {
      const { children } = go(name, strategy);
      const seen = children.flatMap((child) => child.blockIds);
      assert.equal(new Set(seen).size, seen.length, `${name}/${strategy}: a block was chunked twice`);
      const owed = blocksOf(name)
        .filter((block) => block.kind !== 'heading')
        .map((block) => block.id);
      assert.deepEqual(seen, owed, `${name}/${strategy}: a block was lost or reordered`);
    }
  }
});

test('every chunk carries the document and version it must be cited by', () => {
  for (const name of DOCUMENTS) {
    const document = fixture.documents[name];
    for (const strategy of STRATEGIES) {
      const { parents, children } = go(name, strategy);
      for (const item of [...parents, ...children]) {
        assert.equal(item.documentId, document.documentId, `${name}/${strategy}: ${item.id} lost its document`);
        assert.equal(item.version, document.version, `${name}/${strategy}: ${item.id} lost its version`);
      }
    }
  }
});

test('a child carries the same heading trail as the parent it belongs to', () => {
  for (const name of DOCUMENTS) {
    for (const strategy of STRATEGIES) {
      const { parents, children } = go(name, strategy);
      for (const child of children) {
        const parent = parents.find((item) => item.id === child.parentId);
        assert.ok(parent, `${name}/${strategy}: ${child.id} points at no parent`);
        assert.deepEqual(child.trail, parent.trail, `${name}/${strategy}: ${child.id} misdescribes itself`);
      }
    }
  }
});

test('the heading trail is the ancestry, deepest heading last', () => {
  const { parents } = go('policy', 'structural');
  const headings = blocksOf('policy').filter((block) => block.kind === 'heading');
  assert.equal(parents.length, headings.length, 'a heading did not start a parent');
  parents.forEach((parent, index) => {
    const heading = headings[index];
    assert.equal(parent.trail.length, heading.level, `${parent.id}: trail depth disagrees with heading level`);
    assert.equal(parent.trail.at(-1), heading.text, `${parent.id}: trail does not end at its own heading`);
  });
});

test('a heading always starts a new parent, whatever the strategy', () => {
  for (const name of DOCUMENTS) {
    const headings = blocksOf(name).filter((block) => block.kind === 'heading');
    for (const strategy of STRATEGIES) {
      const { parents } = go(name, strategy);
      if (headings.length > 0) {
        assert.equal(parents.length, headings.length, `${name}/${strategy}: parents disagree with headings`);
      }
      for (const parent of parents) {
        assert.ok(parent.blockIds.length > 0, `${name}/${strategy}: an empty parent was emitted`);
      }
    }
  }
});

test('a parent is exactly the sum of what it contains, and children never exceed it', () => {
  for (const name of DOCUMENTS) {
    for (const strategy of STRATEGIES) {
      const { parents, children } = go(name, strategy);
      for (const parent of parents) {
        const owed = parent.blockIds.reduce((total, id) => total + blockOf(name, id).tokens, 0);
        assert.equal(parent.tokens, owed, `${name}/${strategy}: ${parent.id} miscounted`);
        const mine = children.filter((child) => child.parentId === parent.id);
        const spent = mine.reduce((total, child) => total + child.tokens, 0);
        assert.ok(spent <= parent.tokens, `${name}/${strategy}: children of ${parent.id} exceed it`);
      }
      for (const child of children) {
        const owed = child.blockIds.reduce((total, id) => total + blockOf(name, id).tokens, 0);
        assert.equal(child.tokens, owed, `${name}/${strategy}: ${child.id} miscounted`);
      }
    }
  }
});

test('no chunk stops early: a new one starts only because the next block did not fit', () => {
  for (const name of DOCUMENTS) {
    for (const strategy of STRATEGIES) {
      const { children } = go(name, strategy);
      children.forEach((child, index) => {
        const next = children[index + 1];
        if (!next || next.parentId !== child.parentId) return;
        const first = blockOf(name, next.blockIds[0]);
        assert.ok(
          child.tokens + first.tokens > fixture.config.maxChildTokens,
          `${name}/${strategy}: ${child.id} closed at ${child.tokens} with room for ${first.id}`,
        );
      });
    }
  }
});

test('the strategy changes how children are packed and never what parents are', () => {
  for (const name of DOCUMENTS) {
    assert.deepEqual(
      go(name, 'fixed').parents,
      go(name, 'structural').parents,
      `${name}: the strategy moved a section boundary`,
    );
  }
});

test('fixed-size packing never produces fewer chunks than structural packing', () => {
  for (const name of DOCUMENTS) {
    assert.ok(
      go(name, 'fixed').children.length >= go(name, 'structural').children.length,
      `${name}: refusing a cut somehow made more chunks`,
    );
  }
});
