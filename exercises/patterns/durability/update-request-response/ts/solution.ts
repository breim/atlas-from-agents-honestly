export interface State {
  status: 'open' | 'closed';
  creditCents: number;
}

export interface Update {
  kind: string;
  cents: number;
}

export type Response = { ok: true; value: number } | { ok: false; error: string };

export interface Applied {
  state: State;
  responses: Response[];
}

/** Runs before any mutation, so a refusal can never leave a half-applied update behind. */
function reject(state: State, update: Update): string | null {
  if (!['credit', 'close'].includes(update.kind)) return 'unknown_update';
  if (state.status === 'closed') return 'workflow_closed';
  if (update.kind === 'credit' && update.cents <= 0) return 'cents_must_be_positive';
  return null;
}

export function applyUpdates(initial: State, updates: Update[]): Applied {
  let state = { ...initial };
  const responses: Response[] = [];

  for (const update of updates) {
    const error = reject(state, update);
    if (error) {
      responses.push({ ok: false, error });
      continue;
    }

    state =
      update.kind === 'close'
        ? { ...state, status: 'closed' }
        : { ...state, creditCents: state.creditCents + update.cents };

    responses.push({ ok: true, value: state.creditCents });
  }

  return { state, responses };
}
