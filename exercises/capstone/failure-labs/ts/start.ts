import { Unimplemented } from '#harness';

export interface Lab {
  name: string;
  fault: string | null;
  window: string | null;
  invariant: string | null;
  evidence: string[];
  inspects: 'return-status' | 'effect-state';
  assertsBefore: string[];
  bypass: 'attempted' | 'admitted' | null;
  boundHasTerminalPolicy: boolean;
  promotedTo: 'unit' | 'integration' | 'lab' | null;
  artifactsPreserved: boolean;
}

export interface Policy {
  required: string[];
  isolationCheckpoints: string[];
  layers: string[];
}

export interface Verdict {
  lab: string;
  status: 'valid' | 'invalid';
  errors: string[];
  promotedTo: string | null;
}

export interface Report {
  status: 'complete' | 'incomplete';
  verdicts: Verdict[];
  admittedBypasses: string[];
  attemptedBypasses: string[];
}

export function assess(labs: Lab[], policy: Policy): Report {
  throw new Unimplemented('assess');
}
