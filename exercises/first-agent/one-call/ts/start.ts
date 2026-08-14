import { Unimplemented } from '#harness';

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

export function triage(tickets: Ticket[], routes: Record<string, string>): Triaged {
  throw new Unimplemented('triage');
}
