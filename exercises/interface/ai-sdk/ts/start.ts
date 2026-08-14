import { Unimplemented } from '#harness';

export interface Loop {
  owner: 'ai-sdk' | 'langgraph' | 'workflow';
  stopConditions: string[];
  maxSteps: number | null;
}

export interface Shape {
  name: 'one-tool-then-answer' | 'chat' | 'autonomous';
  suggestedMaxSteps: number;
}

export interface Runtime {
  language: 'typescript' | 'python';
  durabilityLives: 'ai-sdk' | 'langgraph' | 'workflow' | 'none';
  loops: Loop[];
  usesDeprecatedObjectApi: boolean;
}

export interface Policy {
  firstPartyStopConditions: string[];
  boundsYouOwn: string[];
  shapes: Shape[];
}

export interface Verdict {
  status: 'sound' | 'unsound';
  errors: string[];
  warnings: string[];
  loopOwner: string | null;
  boundsOwned: string[];
  boundsYours: string[];
}

export function place(runtime: Runtime, shape: Shape['name'], policy: Policy): Verdict {
  throw new Unimplemented('place');
}
