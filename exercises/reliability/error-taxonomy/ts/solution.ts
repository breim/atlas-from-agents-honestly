export interface Failure {
  id: string;
  code: string;
  instruction: string | null;
  retryAfterMs: number | null;
}

export interface Entry {
  class: 'transient' | 'permanent' | 'policy' | 'budget' | 'semantic';
  blame: 'world' | 'you' | 'model' | 'person' | 'limit' | 'nobody';
}

export interface Routed extends Entry {
  id: string;
  retryable: boolean;
  escalates: boolean;
  modelFacing: string | null;
  retryAfterMs: number | null;
}

export interface Routing {
  routed: Routed[];
  retried: string[];
  escalated: string[];
  shownToModel: string[];
  countedInErrorRate: string[];
}

// The model sees an error only when it is the one who can act on it.
const actionable = (entry: Entry) =>
  entry.class === 'policy' ||
  entry.class === 'budget' ||
  (entry.class === 'permanent' && entry.blame === 'model');

export function route(failures: Failure[], catalogue: Record<string, Entry>): Routing {
  const routed = failures.map<Routed>((failure) => {
    const entry = catalogue[failure.code];
    const retryable = entry.class === 'transient';
    return {
      id: failure.id,
      class: entry.class,
      blame: entry.blame,
      retryable,
      escalates: entry.class === 'policy',
      modelFacing: actionable(entry) ? failure.instruction : null,
      // A schedule for a call nobody will make again is noise.
      retryAfterMs: retryable ? failure.retryAfterMs : null,
    };
  });

  const ids = (keep: (entry: Routed) => boolean) => routed.filter(keep).map((entry) => entry.id);

  return {
    routed,
    retried: ids((entry) => entry.retryable),
    escalated: ids((entry) => entry.escalates),
    shownToModel: ids((entry) => entry.modelFacing !== null),
    // One is the system working; the other never raised.
    countedInErrorRate: ids((entry) => entry.class !== 'budget' && entry.class !== 'semantic'),
  };
}
