export interface ScriptStep {
  thought: string;
  action?: string;
  answer?: string;
}

export interface Entry {
  thought: string;
  action?: string;
  observation?: string;
}

export interface Trace {
  status: 'answered' | 'bounded';
  answer: string | null;
  transcript: Entry[];
}

const MISSING = 'error: no such action';

export function react(
  script: ScriptStep[],
  observations: Record<string, string>,
  maxSteps: number,
): Trace {
  const transcript: Entry[] = [];

  for (let step = 0; step < maxSteps && step < script.length; step += 1) {
    const { thought, action, answer } = script[step];

    if (action === undefined) {
      transcript.push({ thought });
      return { status: 'answered', answer: answer ?? null, transcript };
    }

    transcript.push({ thought, action, observation: observations[action] ?? MISSING });
  }

  return { status: 'bounded', answer: null, transcript };
}
