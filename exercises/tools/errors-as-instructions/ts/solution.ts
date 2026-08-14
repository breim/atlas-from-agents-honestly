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

/** Nobody described this failure, so nobody can promise a retry would clear it. */
const UNKNOWN: Instruction = {
  message: 'The tool failed for a reason the agent cannot act on. Report it and stop.',
  retryable: false,
  fields: [],
};

export function instruct(code: string, catalogue: Record<string, Entry>): Instruction {
  const entry = catalogue[code];
  if (!entry) return { ...UNKNOWN };

  return { message: entry.instruction, retryable: entry.retryable, fields: entry.fields };
}
