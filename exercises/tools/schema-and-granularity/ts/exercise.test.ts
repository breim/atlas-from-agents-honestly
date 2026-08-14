import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assessment, Tool, assess as Assess } from './start.ts';

interface Case {
  id: string;
  tool: Tool;
  result: Assessment;
}

const fixture = expected<{
  chapter: string;
  maxParams: number;
  knownFields: string[];
  cases: Case[];
}>(import.meta.url);
const { assess } = await loadImpl<{ assess: typeof Assess }>(import.meta.url);

const run = (entry: Case) => assess(entry.tool, fixture.knownFields, fixture.maxParams);

const cases: Array<[string, string]> = [
  ['one-effect-and-knowable-parameters-is-well-scoped', 'a well-scoped tool passes'],
  ['two-effects-in-one-tool-is-too-coarse', 'a mode switch is two tools'],
  ['a-required-parameter-the-model-cannot-know-is-a-design-error', 'the model will invent it'],
  ['an-optional-unknowable-parameter-is-fine', 'optional means the model can omit it'],
  ['too-many-parameters-is-flagged', 'the ceiling is enforced'],
  ['every-issue-is-reported-in-order', 'one review reports everything'],
  ['a-tool-with-no-parameters-is-fine', 'a tool need not take arguments'],
  ['a-tool-with-no-effect-is-not-a-tool', 'a tool that does nothing wastes a step'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the verdict always follows the issues', () => {
  for (const entry of fixture.cases) {
    const { verdict, issues } = run(entry);
    assert.equal(verdict, issues.length === 0 ? 'ok' : 'revise', `${entry.id}: verdict mismatch`);
  }
});

test('an optional parameter is never flagged as undeterminable', () => {
  for (const entry of fixture.cases) {
    const optional = entry.tool.params.filter((param) => !param.required);
    for (const param of optional) {
      assert.ok(
        !run(entry).issues.includes(`undeterminable_param:${param.name}`),
        `${entry.id}: flagged the optional ${param.name}`,
      );
    }
  }
});

test('making every required parameter knowable removes those issues', () => {
  for (const entry of fixture.cases) {
    const generous = [...fixture.knownFields, ...entry.tool.params.map((p) => p.name)];
    const issues = assess(entry.tool, generous, fixture.maxParams).issues;
    assert.ok(
      issues.every((issue) => !issue.startsWith('undeterminable_param')),
      `${entry.id}: a knowable parameter was still flagged`,
    );
  }
});

test('a tool passing review has one effect and no unknowable requirement', () => {
  for (const entry of fixture.cases) {
    if (run(entry).verdict !== 'ok') continue;
    assert.equal(entry.tool.effects.length, 1, `${entry.id}: passed without exactly one effect`);
    assert.ok(entry.tool.params.length <= fixture.maxParams, `${entry.id}: passed over the ceiling`);
    for (const param of entry.tool.params.filter((p) => p.required)) {
      assert.ok(fixture.knownFields.includes(param.name), `${entry.id}: passed with ${param.name}`);
    }
  }
});
