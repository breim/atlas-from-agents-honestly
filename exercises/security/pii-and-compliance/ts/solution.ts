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

// Classification lives on the field, assigned at the schema, not guessed from the value.
const PERSONAL = ['personal', 'restricted'];

export function assemble(record: Field[], stores: Store[], vault: Record<string, string>): Assembled {
  const prompt = record.map((field) => ({
    name: field.name,
    rendered:
      field.render === 'verbatim'
        ? field.value
        : field.render === 'pseudonym'
          ? vault[field.value]
          : '[redacted]',
  }));

  const personal = record.filter((field) => PERSONAL.includes(field.sensitivity));
  // Redacting at assembly is what every prompt-fed copy inherits. A raw store inherits
  // nothing, which is why deletion still has to work there.
  const inPrompt = personal.filter((field) => field.render === 'verbatim').map((field) => field.name);
  const all = personal.map((field) => field.name);

  const exposure = stores.map((store) => ({
    store: store.name,
    personalFields: store.receives === 'raw' ? all : inPrompt,
  }));

  return {
    prompt,
    exposure,
    // Personal data with no subject key is personal data you cannot delete on request.
    unerasable: exposure
      .filter((entry) => entry.personalFields.length > 0)
      .filter((entry) => !stores.find((store) => store.name === entry.store)!.keyedBySubject)
      .map((entry) => entry.store),
  };
}
