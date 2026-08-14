import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Ticket, Triaged, triage as Triage } from './start.ts';

interface Case {
  id: string;
  routes?: Record<string, string>;
  tickets: Ticket[];
  result: Triaged;
}

const fixture = expected<{ chapter: string; routes: Record<string, string>; cases: Case[] }>(import.meta.url);
const { triage } = await loadImpl<{ triage: typeof Triage }>(import.meta.url);

const routesOf = (entry: Case) => entry.routes ?? fixture.routes;
const run = (entry: Case, tickets = entry.tickets, routes = routesOf(entry)) => triage(tickets, routes);

const cases: Array<[string, string]> = [
  ['a-perfect-classifier-resolves-nothing', 'excellent at its job, and a hard ceiling'],
  ['a-ticket-answerable-from-its-own-text-is-resolved', 'the one shape a single call can close'],
  ['a-wrong-category-is-not-resolved-even-when-answerable', 'answerable is not the only condition'],
  ['an-oblique-order-reference-costs-an-entity-not-a-category', 'two of the twenty'],
  ['the-right-number-of-entities-is-not-the-right-entities', 'a count is not a match'],
  ['two-categories-that-share-a-queue-still-route-correctly', 'the label and the destination differ'],
  ['a-self-report-that-disagrees-with-reality', 'a signal, not a guarantee'],
  ['an-empty-inbox-scores-nothing', 'no tickets, no ceiling'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('one routing per ticket, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry).routed.map((r) => r.id), entry.tickets.map((t) => t.id), entry.id);
  }
});

test('every ticket goes where the table says its predicted category goes', () => {
  for (const entry of fixture.cases) {
    const routes = routesOf(entry);
    run(entry).routed.forEach((item, index) => {
      assert.equal(item.queue, routes[entry.tickets[index].predicted.category], `${entry.id}: ${item.id}`);
    });
  }
});

test('every count sits between nothing and everything', () => {
  for (const entry of fixture.cases) {
    const { scoreboard } = run(entry);
    assert.equal(scoreboard.total, entry.tickets.length, entry.id);
    for (const [name, value] of Object.entries(scoreboard)) {
      assert.ok(value >= 0 && value <= scoreboard.total, `${entry.id}: ${name} is ${value}`);
    }
  }
});

test('nothing is resolved that was not answerable from the ticket alone', () => {
  for (const entry of fixture.cases) {
    const answerable = entry.tickets.filter((ticket) => ticket.truth.answerable).length;
    assert.ok(run(entry).scoreboard.resolved <= answerable, `${entry.id}: resolved the unanswerable`);
  }
});

test('a classifier that is never wrong still resolves nothing when nothing is answerable', () => {
  for (const entry of fixture.cases) {
    const perfect = entry.tickets.map((ticket) => ({ ...ticket, predicted: { ...ticket.truth } }));
    const { scoreboard } = run(entry, perfect);
    assert.equal(scoreboard.categoryCorrect, scoreboard.total, `${entry.id}: a perfect run scored badly`);
    const grounded = perfect.map((ticket) => ({
      ...ticket,
      predicted: { ...ticket.predicted, answerable: false },
      truth: { ...ticket.truth, answerable: false },
    }));
    assert.equal(run(entry, grounded).scoreboard.resolved, 0, `${entry.id}: a ceiling was crossed`);
  }
});

test('resolving requires the category too', () => {
  for (const entry of fixture.cases) {
    const { scoreboard } = run(entry);
    assert.ok(scoreboard.resolved <= scoreboard.categoryCorrect, `${entry.id}: resolved a mislabelled ticket`);
  }
});

test('a correct category always routes correctly', () => {
  for (const entry of fixture.cases) {
    const { scoreboard } = run(entry);
    assert.ok(scoreboard.routedCorrectly >= scoreboard.categoryCorrect, `${entry.id}: the table lost one`);
  }
});

test('the self-report decides nothing', () => {
  for (const entry of fixture.cases) {
    const before = run(entry);
    const flipped = entry.tickets.map((ticket) => ({
      ...ticket,
      predicted: { ...ticket.predicted, answerable: !ticket.predicted.answerable },
    }));
    const after = run(entry, flipped);
    assert.deepEqual(after.routed, before.routed, `${entry.id}: a self-report moved a ticket`);
    const { selfReportAgreed: _, ...rest } = after.scoreboard;
    const { selfReportAgreed: __, ...before_ } = before.scoreboard;
    assert.deepEqual(rest, before_, `${entry.id}: a self-report moved a score`);
  }
});

test('entity extraction is scored exactly, order included', () => {
  for (const entry of fixture.cases) {
    const owed = entry.tickets.filter(
      (ticket) =>
        JSON.stringify(ticket.predicted.orderIds) === JSON.stringify(ticket.truth.orderIds) &&
        JSON.stringify(ticket.predicted.partNumbers) === JSON.stringify(ticket.truth.partNumbers),
    ).length;
    assert.equal(run(entry).scoreboard.entitiesCorrect, owed, entry.id);
  }
});
