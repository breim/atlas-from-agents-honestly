export interface Signal {
  workflowId: string;
  payload: string;
}

export interface Delivery {
  started: string[];
  workflows: Record<string, string[]>;
}

export function signalWithStart(running: string[], signals: Signal[]): Delivery {
  const live = new Set(running);
  const delivery: Delivery = { started: [], workflows: {} };

  for (const { workflowId, payload } of signals) {
    if (!live.has(workflowId)) {
      live.add(workflowId);
      delivery.started.push(workflowId);
    }

    (delivery.workflows[workflowId] ??= []).push(payload);
  }

  return delivery;
}
