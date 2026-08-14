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

const validate = (state: State, message: Message, limit: number): Response['error'] => {
  if (state.phase !== 'awaiting-approval') return 'invalid_phase';
  if ((message.amountCents ?? 0) > limit) return 'above_limit';
  return undefined;
};

export function apply(messages: Message[], limit: number): Mailbox {
  const state: State = { started: false, phase: null, approvedCents: null };
  const history: string[] = [];
  const responses: Response[] = [];

  for (const message of messages) {
    if (message.kind === 'signal_with_start' && !state.started) {
      state.started = true;
      state.phase = 'awaiting-approval';
      history.push('started');
    }

    if (!state.started) {
      responses.push({ ok: false, error: 'not_running' });
      continue;
    }

    // A getter: no mutation, and nothing written down, which is what makes polling cheap.
    if (message.kind === 'query') {
      responses.push({ ok: true, value: state.phase! });
      continue;
    }

    if (message.kind === 'update') {
      // Read-only, and it runs before anything is recorded.
      const error = validate(state, message, limit);
      if (error) {
        responses.push({ ok: false, error });
        continue;
      }
      history.push(`update:${message.name}`);
      state.phase = 'issuing';
      state.approvedCents = message.amountCents!;
      responses.push({ ok: true, value: state.phase });
      continue;
    }

    history.push(`signal:${message.name}`);
    if (message.name === 'timer_expired' && state.phase === 'awaiting-approval') {
      state.phase = 'escalated';
    }
    // Acknowledged either way. The caller cannot learn which of those two things happened.
    responses.push({ ok: true });
  }

  return { state, history, responses };
}
