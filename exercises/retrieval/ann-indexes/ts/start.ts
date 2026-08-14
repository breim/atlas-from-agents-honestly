import { Unimplemented } from '#harness';

export interface Recall {
  recallBps: number;
  missed: string[];
  extra: string[];
}

export function measure(_exact: string[], _approximate: string[]): Recall {
  throw new Unimplemented('measure');
}
