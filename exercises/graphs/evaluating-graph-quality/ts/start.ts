import { Unimplemented } from '#harness';

export interface Triple {
  from: string;
  type: string;
  to: string;
}

export interface Quality {
  precisionBps: number;
  recallBps: number;
  spurious: Triple[];
  missed: Triple[];
}

export function evaluate(_extracted: Triple[], _gold: Triple[]): Quality {
  throw new Unimplemented('evaluate');
}
