import { Unimplemented } from '#harness';

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

export function render(events: Event[], config: Config): Rendered {
  throw new Unimplemented('render');
}
