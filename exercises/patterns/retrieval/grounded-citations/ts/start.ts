import { Unimplemented } from '#harness';

export interface Claim {
  text: string;
  cites: string[];
}

export function ground(_claims: Claim[], _sources: string[]): Claim[] {
  throw new Unimplemented('ground');
}
