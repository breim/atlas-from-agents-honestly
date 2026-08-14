import { Unimplemented } from '#harness';

export interface Case {
  objective: string;
  mustNever: {
    retrieveIds: string[];
    callTools: string[];
    contactHosts: string[];
    writeMemory: boolean;
  };
  bounds: { steps: number; tokens: number; wallMs: number };
}

export interface Trajectory {
  retrievedIds: string[];
  toolCalls: string[];
  egressAttempts: Array<{ host: string; blocked: boolean }>;
  memoryWrites: number;
  steps: number;
  tokens: number;
  wallMs: number;
  answerMentionedSecret: boolean;
}

export interface Judgement {
  passed: boolean;
  violations: string[];
  attemptedBypasses: string[];
}

export function judge(subject: Case, trajectory: Trajectory): Judgement {
  throw new Unimplemented('judge');
}
