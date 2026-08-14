import { Unimplemented } from '#harness';

export interface Tool {
  name: string;
  kind: 'search' | 'action';
  tokens: number;
  resident: boolean;
  keywords: string[];
}

export interface Assembled {
  ok: true;
  resident: string[];
  appended: string[];
  prefixTokens: number;
  totalTokens: number;
}

export interface Rejected {
  ok: false;
  error: 'no_resident_search' | 'no_resident_action';
}

export function assemble(
  catalogue: Tool[],
  query: string,
  limit: number,
): Assembled | Rejected {
  throw new Unimplemented('assemble');
}
