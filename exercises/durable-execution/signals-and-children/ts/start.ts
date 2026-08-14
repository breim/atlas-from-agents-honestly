import { Unimplemented } from '#harness';

export interface Message {
  kind: 'signal' | 'query' | 'update' | 'signal_with_start';
  name: string;
  amountCents?: number;
}

export interface State {
  started: boolean;
  phase: string | null;
  approvedCents: number | null;
}

export interface Response {
  ok: boolean;
  value?: string;
  error?: 'not_running' | 'invalid_phase' | 'above_limit';
}

export interface Mailbox {
  state: State;
  history: string[];
  responses: Response[];
}

export function apply(messages: Message[], limit: number): Mailbox {
  throw new Unimplemented('apply');
}
