import { Unimplemented } from '#harness';

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

export function collect(spans: Span[], config: Config, providerTokens: number): Collected {
  throw new Unimplemented('collect');
}
