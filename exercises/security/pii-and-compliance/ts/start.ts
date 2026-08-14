import { Unimplemented } from '#harness';

export interface Field {
  name: string;
  value: string;
  sensitivity: 'public' | 'internal' | 'personal' | 'restricted';
  render: 'verbatim' | 'pseudonym' | 'omit';
}

export interface Store {
  name: string;
  receives: 'prompt' | 'raw';
  keyedBySubject: boolean;
}

export interface Assembled {
  prompt: Array<{ name: string; rendered: string }>;
  exposure: Array<{ store: string; personalFields: string[] }>;
  unerasable: string[];
}

export function assemble(record: Field[], stores: Store[], vault: Record<string, string>): Assembled {
  throw new Unimplemented('assemble');
}
