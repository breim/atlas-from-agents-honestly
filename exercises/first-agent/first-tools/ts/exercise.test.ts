import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type {
  Answered,
  Block,
  Response,
  Ticket,
  ToolResultBlock,
  ToolSpec,
  ToolUseBlock,
  answer as Answer,
} from './start.ts';

interface Case {
  id: string;
  ticket: Ticket;
  script: Response[];
  result: Answered;
}

interface Fixture {
  chapter: string;
  catalogue: ToolSpec[];
  world: Record<string, string>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { answer } = await loadImpl<{ answer: typeof Answer }>(import.meta.url);

const run = (entry: Case, script = entry.script) => answer(entry.ticket, script, fixture.catalogue, fixture.world);

const toolUses = (content: Block[]) => content.filter((block): block is ToolUseBlock => block.type === 'tool_use');

const cases: Array<[string, string]> = [
  ['a-single-lookup-takes-two-requests', 'one answer, two billed requests'],
  ['a-model-that-answers-without-a-tool-costs-one-request', 'no tool, no round trip'],
  ['parallel-calls-return-in-one-user-message', 'two calls, one message'],
  ['an-error-is-a-message-not-a-missing-result', 'a failure the model can read'],
  ['one-failure-does-not-drop-the-other-result', 'never silently drop a result'],
  ['an-unknown-tool-is-an-error-the-model-can-read', 'a name that is not in the catalogue'],
  ['a-missing-argument-is-an-error-the-model-can-read', 'a call with garbage arguments'],
  ['the-if-is-not-a-while', 'the model asks again and nothing is listening'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every issued tool_use_id comes back exactly once, even when the tool failed', () => {
  for (const entry of fixture.cases) {
    const { transcript } = run(entry);
    transcript.forEach((message, index) => {
      if (message.role !== 'assistant') return;
      const issued = toolUses(message.content as Block[]).map((block) => block.id);
      if (issued.length === 0) return;
      const results = transcript[index + 1].content as ToolResultBlock[];
      assert.deepEqual(results.map((result) => result.toolUseId), issued, `${entry.id}: ids did not match`);
    });
  }
});

test('a failing tool returns a result rather than throwing, and marks it', () => {
  for (const entry of fixture.cases) {
    for (const message of run(entry).transcript) {
      if (message.role !== 'user' || typeof message.content === 'string') continue;
      for (const result of message.content as ToolResultBlock[]) {
        const failed = result.content.startsWith('Error: ');
        assert.equal(result.isError ?? false, failed, `${entry.id}: ${result.toolUseId} was mislabelled`);
      }
    }
  }
});

test('every result for a turn arrives in one user message', () => {
  for (const entry of fixture.cases) {
    const { transcript } = run(entry);
    const bearing = transcript.filter(
      (message) => message.role === 'user' && typeof message.content !== 'string',
    );
    assert.ok(bearing.length <= 1, `${entry.id}: results were split across ${bearing.length} messages`);
    for (const message of bearing) {
      const issued = transcript.flatMap((m) => (m.role === 'assistant' ? toolUses(m.content as Block[]) : []));
      assert.equal((message.content as ToolResultBlock[]).length, issued.length, `${entry.id}: partial batch`);
    }
  }
});

test('the assistant turn is echoed back verbatim, tool_use blocks included', () => {
  for (const entry of fixture.cases) {
    const { transcript } = run(entry);
    if (entry.script[0].stopReason !== 'tool_use') continue;
    assert.deepEqual(transcript[1].content, entry.script[0].content, `${entry.id}: the turn was reconstructed`);
  }
});

test('results enter the transcript as user content, marked as nothing', () => {
  for (const entry of fixture.cases) {
    for (const message of run(entry).transcript) {
      if (typeof message.content === 'string') continue;
      const isResults = (message.content as ToolResultBlock[]).some((block) => block.type === 'tool_result');
      if (isResults) assert.equal(message.role, 'user', `${entry.id}: a tool result was not user content`);
    }
  }
});

test('the second request resends everything the first one sent', () => {
  for (const entry of fixture.cases) {
    const { transcript, requests } = run(entry);
    assert.deepEqual(requests, requests.map((_, index) => index * 2 + 1), `${entry.id}: history was trimmed`);
    assert.deepEqual(transcript[0], { role: 'user', content: entry.ticket.body }, `${entry.id}: the ticket moved`);
    for (let index = 1; index < requests.length; index += 1) {
      assert.ok(requests[index] > requests[index - 1], `${entry.id}: a request shrank`);
    }
  }
});

test('one round of tool use, no matter how many times the model asks', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    assert.ok(result.rounds <= 1, `${entry.id}: ran ${result.rounds} rounds`);
    assert.equal(result.requests.length, result.rounds + 1, `${entry.id}: request count disagrees with rounds`);
  }
});

test('an unanswered run says so instead of inventing an answer', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    const last = entry.script[result.requests.length - 1];
    const stalled = last.stopReason === 'tool_use';
    assert.equal(result.outcome, stalled ? 'unresolved' : 'answered', entry.id);
    assert.equal(result.answer === null, stalled, `${entry.id}: answer disagrees with outcome`);
  }
});

test('a model that never stops asking never gets past the second request', () => {
  const entry = findCase<Case>(fixture, 'the-if-is-not-a-while');
  const insatiable = entry.script.map((response) => ({ ...entry.script[0], ...response, stopReason: 'tool_use' as const }));
  const result = run(entry, insatiable);
  assert.equal(result.requests.length, 2, 'the `if` behaved like a `while`');
  assert.equal(result.outcome, 'unresolved');
});
