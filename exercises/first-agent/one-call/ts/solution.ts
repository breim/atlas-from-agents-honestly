export interface Triage {
  category: string;
  orderIds: string[];
  partNumbers: string[];
  answerable: boolean;
}

export interface Ticket {
  id: string;
  predicted: Triage;
  truth: Triage;
}

export interface Scoreboard {
  total: number;
  categoryCorrect: number;
  entitiesCorrect: number;
  routedCorrectly: number;
  selfReportAgreed: number;
  resolved: number;
}

export interface Triaged {
  routed: Array<{ id: string; queue: string }>;
  scoreboard: Scoreboard;
}

const same = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export function triage(tickets: Ticket[], routes: Record<string, string>): Triaged {
  // Control flow is yours. The model classified; the table decides where it goes.
  const routed = tickets.map((ticket) => ({ id: ticket.id, queue: routes[ticket.predicted.category] }));

  const count = (holds: (ticket: Ticket) => boolean) => tickets.filter(holds).length;
  const rightCategory = (ticket: Ticket) => ticket.predicted.category === ticket.truth.category;

  return {
    routed,
    scoreboard: {
      total: tickets.length,
      categoryCorrect: count(rightCategory),
      entitiesCorrect: count(
        (ticket) =>
          same(ticket.predicted.orderIds, ticket.truth.orderIds) &&
          same(ticket.predicted.partNumbers, ticket.truth.partNumbers),
      ),
      // Labelling it wrong is not the same as sending it to the wrong place.
      routedCorrectly: count((ticket) => routes[ticket.predicted.category] === routes[ticket.truth.category]),
      // A self-report, scored against reality and used for nothing else.
      selfReportAgreed: count((ticket) => ticket.predicted.answerable === ticket.truth.answerable),
      // The ceiling: one call resolves a ticket only if the ticket was answerable from
      // its own text and the category was right.
      resolved: count((ticket) => ticket.truth.answerable && rightCategory(ticket)),
    },
  };
}
