import { Unimplemented } from '#harness';

export interface Rule {
  pattern: string;
  action: 'redact' | 'block';
  label: string;
}

export interface Guarded {
  released: boolean;
  text: string;
  hits: string[];
}

export function guard(_text: string, _rules: Rule[]): Guarded {
  throw new Unimplemented('guard');
}
