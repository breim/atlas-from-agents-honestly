import { Unimplemented } from '#harness';

export interface Entry {
  instruction: string;
  retryable: boolean;
  fields: string[];
}

export interface Instruction {
  message: string;
  retryable: boolean;
  fields: string[];
}

export function instruct(_code: string, _catalogue: Record<string, Entry>): Instruction {
  throw new Unimplemented('instruct');
}
