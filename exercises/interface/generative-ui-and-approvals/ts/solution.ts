export interface Event {
  kind:
    | 'input_streaming'
    | 'input_available'
    | 'executing'
    | 'output_available'
    | 'error'
    | 'gate'
    | 'approve_submitted'
    | 'approve_accepted'
    | 'approve_rejected';
  tool?: string;
  subject?: string;
  elapsedMs?: number;
  approver?: string;
}

export interface Config {
  registry: Record<string, { component: string }>;
  fallback: string;
  spinnerAfterMs: number;
  driver: string;
}

export interface Frame {
  state: string;
  component: string;
  detail: string | null;
  spinner: boolean;
  status: string | null;
}

export interface Card {
  tool: string;
  subject: string;
  placement: 'inline' | 'queue';
  frame: number;
}

export interface Rendered {
  frames: Frame[];
  card: Card | null;
}

const APPROVAL: Record<string, string> = {
  gate: 'pending',
  approve_submitted: 'submitted',
  approve_accepted: 'accepted',
  approve_rejected: 'rejected',
};

export function render(events: Event[], config: Config): Rendered {
  const frames: Frame[] = [];
  let card: Card | null = null;

  events.forEach((event, index) => {
    if (event.kind === 'gate') {
      // Rendered once, at the moment the gate fires. Every surface displays these bytes.
      card = {
        tool: event.tool!,
        subject: event.subject!,
        placement: event.approver === config.driver ? 'inline' : 'queue',
        frame: index,
      };
    }

    const status = APPROVAL[event.kind] ?? null;
    if (status !== null) {
      frames.push({
        state: event.kind,
        component: 'ApprovalCard',
        detail: card?.subject ?? null,
        spinner: false,
        status,
      });
      return;
    }

    // The result component appears when the result does, and not one frame earlier.
    const component =
      event.kind === 'output_available'
        ? (config.registry[event.tool!]?.component ?? config.fallback)
        : event.kind === 'error'
          ? 'ErrorState'
          : 'StatusLine';

    frames.push({
      state: event.kind,
      component,
      detail: event.subject ?? null,
      spinner: (event.elapsedMs ?? 0) >= config.spinnerAfterMs,
      status: null,
    });
  });

  return { frames, card };
}
