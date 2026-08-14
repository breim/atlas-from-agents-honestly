export type Value = string | number | boolean;

export interface Span {
  id: string;
  type: 'invoke_agent' | 'chat' | 'execute_tool';
  emitter: string;
  attributes: Record<string, Value>;
}

export interface Config {
  owners: Record<string, string>;
  conventionKeys: string[];
  contentKeys: string[];
  namespace: string;
  captureContent: boolean;
}

export interface Collected {
  kept: string[];
  dropped: string[];
  redacted: string[];
  violations: string[];
  tokens: number;
  tokensMatchProvider: boolean;
}

const USAGE = ['gen_ai.usage.input_tokens', 'gen_ai.usage.output_tokens'];

export function collect(spans: Span[], config: Config, providerTokens: number): Collected {
  // Exactly one owner per span type. Anyone else wrapping the same call is a second copy.
  const kept = spans.filter((span) => span.emitter === config.owners[span.type]);
  const dropped = spans.filter((span) => span.emitter !== config.owners[span.type]);

  const redacted: string[] = [];
  const violations: string[] = [];

  for (const span of kept) {
    const keys = Object.keys(span.attributes).sort();

    if (!config.captureContent && keys.some((key) => config.contentKeys.includes(key))) {
      redacted.push(span.id);
    }

    for (const key of keys) {
      if (key.startsWith('gen_ai.')) {
        if (!config.conventionKeys.includes(key)) violations.push(`${span.id}:unknown_convention_key:${key}`);
      } else if (!key.startsWith(`${config.namespace}.`)) {
        violations.push(`${span.id}:unnamespaced_key:${key}`);
      }
    }
  }

  const tokens = kept.reduce(
    (sum, span) => sum + USAGE.reduce((used, key) => used + Number(span.attributes[key] ?? 0), 0),
    0,
  );

  return {
    kept: kept.map((span) => span.id),
    dropped: dropped.map((span) => span.id),
    redacted,
    violations,
    tokens,
    tokensMatchProvider: tokens === providerTokens,
  };
}
