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

export function guard(text: string, rules: Rule[]): Guarded {
  const hits: string[] = [];
  let blocked = false;
  let out = text;

  for (const rule of rules) {
    if (!out.includes(rule.pattern)) continue;

    hits.push(rule.label);
    if (rule.action === 'block') blocked = true;
    else out = out.replaceAll(rule.pattern, `[redacted:${rule.label}]`);
  }

  return blocked ? { released: false, text: '', hits } : { released: true, text: out, hits };
}
