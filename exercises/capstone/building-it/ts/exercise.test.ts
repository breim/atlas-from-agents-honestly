import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Build, Policy, Question, Review, review as ReviewFn } from './start.ts';

interface Case { id: string; build: Build; questions: Question[]; policy: Policy; result: Review }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { review } = await loadImpl<{ review: typeof ReviewFn }>(import.meta.url);
const go = (entry: Case, build = entry.build, questions = entry.questions) => review(build, questions, entry.policy);

const cases: Array<[string, string]> = [
  ['nine-tools-a-small-graph-and-four-retrievers', 'bottom-up, in order'],
  ['nineteen-tools-is-nineteen-permissions', 'every tool is a permission'],
  ['issue-credit-taking-an-amount-should-derive-it', 're-derive, do not accept'],
  ['send-reply-with-a-recipient-reopens-the-exfiltration-path', 'remove the parameter'],
  ['a-class-four-tool-with-no-paired-read-leaves-unknown-unresolvable', 'the paired read'],
  ['a-model-call-left-in-workflow-code-is-blocked', 'activity code discovers'],
  ['a-decision-pushed-into-an-activity-is-blocked', 'workflow code decides'],
  ['an-unsplit-corpus-lets-a-poisoned-chunk-reach-a-write', 'split by trust'],
  ['a-workflow-id-without-the-tenant-loses-structural-tenancy', 'one decision, two properties'],
  ['a-question-with-no-retriever-for-its-kind-is-blocked', 'route before retrieving'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('the catalogue is bounded, at the boundary', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  const cap = entry.policy.maxTools;
  const spare = entry.build.tools[0];
  for (const count of [cap - 1, cap, cap + 1]) {
    const tools = Array.from({ length: count }, (_, index) => ({ ...spare, name: `t${index}` }));
    const outcome = go(entry, { ...entry.build, tools });
    assert.equal(outcome.status === 'blocked', count > cap, `${count} tools against a cap of ${cap}`);
  }
});

test('no tool may take an argument the system can derive', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  for (const argument of entry.policy.forbiddenArgs) {
    for (const tool of entry.build.tools) {
      const tools = entry.build.tools.map((item) =>
        item.name === tool.name ? { ...item, args: [...item.args, argument] } : item,
      );
      const outcome = go(entry, { ...entry.build, tools });
      assert.equal(outcome.status, 'blocked', `${tool.name} took ${argument} and passed`);
      assert.ok(outcome.errors.some((error) => error.includes(argument)), `${argument} unnamed`);
    }
  }
});

test('every write above class three needs a paired read, and reads do not', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  for (const tool of entry.build.tools) {
    const tools = entry.build.tools.map((item) =>
      item.name === tool.name ? { ...item, pairedRead: null } : item,
    );
    const outcome = go(entry, { ...entry.build, tools });
    assert.equal(outcome.status === 'blocked', tool.klass >= 4, `${tool.name} is class ${tool.klass}`);
  }
});

test('every node sits on the side of the split its work demands', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  for (const node of entry.build.nodes) {
    for (const placement of ['workflow', 'activity'] as const) {
      const nodes = entry.build.nodes.map((item) => (item.name === node.name ? { ...item, placement } : item));
      const outcome = go(entry, { ...entry.build, nodes });
      const owed = node.work === 'decide' ? placement === 'workflow' : placement === 'activity';
      assert.equal(outcome.status === 'shippable', owed, `${node.name} (${node.work}) in ${placement}`);
    }
  }
});

test('the graph is mostly activities, and every count adds up', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(
      outcome.activities + outcome.workflowNodes,
      entry.build.nodes.length,
      `${entry.id}: nodes were lost`,
    );
    assert.equal(
      outcome.activities,
      entry.build.nodes.filter((node) => node.placement === 'activity').length,
      `${entry.id}: activity count`,
    );
  }
});

test('every question routes to a retriever chosen for its kind', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(
      outcome.routing.map((route) => route.question),
      entry.questions.map((question) => question.id),
      `${entry.id}: a question was dropped`,
    );
    for (const [index, route] of outcome.routing.entries()) {
      assert.equal(
        route.retriever,
        entry.policy.routes[entry.questions[index].kind] ?? null,
        `${entry.id}: ${route.question}`,
      );
    }
  }
});

test('the four question kinds go to four different retrievers', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  const retrievers = go(entry).routing.map((route) => route.retriever);
  assert.equal(new Set(retrievers).size, retrievers.length, 'two kinds shared a retriever');
  assert.equal(retrievers.length, 4, 'the fixture no longer covers four kinds');
});

test('the tenant must appear in the workflow id', () => {
  const entry = findCase<Case>(fixture, 'nine-tools-a-small-graph-and-four-retrievers');
  for (const workflowId of ['atlas-meridian-8823', 'atlas-8823', 'meridian', '']) {
    const outcome = go(entry, { ...entry.build, workflowId });
    assert.equal(outcome.status === 'shippable', workflowId.includes(entry.build.tenantId), workflowId || '(empty)');
  }
});

test('a blocked build ships nothing and still explains itself', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'blocked') continue;
    assert.ok(outcome.errors.length > 0, `${entry.id}: blocked without a reason`);
    assert.equal(outcome.routing.length, entry.questions.length, `${entry.id}: routing was dropped on a block`);
  }
});
