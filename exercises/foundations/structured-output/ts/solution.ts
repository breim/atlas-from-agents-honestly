export interface Field {
  name: string;
  type: 'string' | 'number' | 'boolean';
}

export type Parsed =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function parse(text: string, schema: Field[]): Parsed {
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open === -1 || close < open) return { ok: false, error: 'no_json' };

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text.slice(open, close + 1));
  } catch {
    return { ok: false, error: 'malformed_json' };
  }

  for (const field of schema) {
    if (!Object.hasOwn(value, field.name)) {
      return { ok: false, error: `missing_field:${field.name}` };
    }
  }

  for (const field of schema) {
    if (typeof value[field.name] !== field.type) {
      return { ok: false, error: `wrong_type:${field.name}` };
    }
  }

  const known = new Set(schema.map((field) => field.name));
  const extra = Object.keys(value).find((key) => !known.has(key));
  if (extra !== undefined) return { ok: false, error: `unknown_field:${extra}` };

  return { ok: true, value };
}
