import { Unimplemented } from '#harness';

export interface Signal {
  workflowId: string;
  payload: string;
}

export interface Delivery {
  started: string[];
  workflows: Record<string, string[]>;
}

export function signalWithStart(_running: string[], _signals: Signal[]): Delivery {
  throw new Unimplemented('signalWithStart');
}
