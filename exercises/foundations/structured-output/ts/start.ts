import { Unimplemented } from '#harness';

export interface Field {
  name: string;
  type: 'string' | 'number' | 'boolean';
}

export type Parsed =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function parse(_text: string, _schema: Field[]): Parsed {
  throw new Unimplemented('parse');
}
