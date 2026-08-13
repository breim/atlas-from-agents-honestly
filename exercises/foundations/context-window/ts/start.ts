import { Unimplemented } from '#harness';

export interface Section {
  name: string;
  tokens: number;
}

export interface Plan {
  input: number;
  reserved: number;
  headroom: number;
  fits: boolean;
  overBy: number;
}

export function plan(_sections: Section[], _maxOutput: number, _windowTokens: number): Plan {
  throw new Unimplemented('plan');
}
