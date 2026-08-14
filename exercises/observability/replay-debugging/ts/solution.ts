export interface Serving {
  model: string;
  effort: string;
}

export interface Recording {
  serving: Serving;
  events: Array<{ prompt: string; response: string }>;
}

export interface Config {
  serving: Serving;
  thresholdBps: number;
}

export interface Replayed {
  status: 'replayed' | 'stale' | 'diverged' | 'exhausted';
  responses: string[];
  consumed: number;
  driftBps: number[];
}

const tokens = (prompt: string) => new Set(prompt.split(/\s+/).filter(Boolean));

export function drift(recorded: string, requested: string): number {
  const a = tokens(recorded);
  const b = tokens(requested);
  const shared = [...a].filter((token) => b.has(token)).length;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : 10000 - Math.floor((shared * 10000) / union + 0.5);
}

export function replay(recording: Recording, requests: string[], config: Config): Replayed {
  // Once, and exactly. A model upgrade alters no prompt text and stales everything.
  const sameServing =
    recording.serving.model === config.serving.model && recording.serving.effort === config.serving.effort;
  if (!sameServing) return { status: 'stale', responses: [], consumed: 0, driftBps: [] };

  const responses: string[] = [];
  const driftBps: number[] = [];

  for (const requested of requests) {
    const event = recording.events[responses.length];
    if (!event) return { status: 'exhausted', responses, consumed: responses.length, driftBps };

    // Per step, and tolerantly. A rebuilt prompt makes the recorded answer irrelevant.
    const delta = drift(event.prompt, requested);
    driftBps.push(delta);
    if (delta > config.thresholdBps) {
      return { status: 'diverged', responses, consumed: responses.length, driftBps };
    }

    responses.push(event.response);
  }

  return { status: 'replayed', responses, consumed: responses.length, driftBps };
}
