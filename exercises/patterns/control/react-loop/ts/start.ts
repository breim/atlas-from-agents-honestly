import { Unimplemented } from '#harness';

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

export function react(
  _script: ScriptStep[],
  _observations: Record<string, string>,
  _maxSteps: number,
): Trace {
  throw new Unimplemented('react');
}
