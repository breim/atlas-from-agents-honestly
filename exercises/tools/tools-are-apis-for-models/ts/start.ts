import { Unimplemented } from '#harness';

export interface Endpoint {
  id: string;
  fields: Record<string, number>;
}

export interface Design {
  name: string;
  description: string;
  notFor?: string;
  job: string[];
  returns: string[];
  args: string[];
}

export interface Policy {
  identityFields: string[];
  maxLiveTools: number;
  minDescriptionWords: number;
}

export interface Tool {
  name: string;
  arguments: string[];
  returns: string[];
  roundTrips: number;
  endpoints: number;
  tokens: number;
}

export interface Totals {
  toolCount: number;
  roundTrips: number;
  tokens: number;
}

export interface Surface {
  tools: Tool[];
  rejected: Array<{ name: string; reason: string }>;
  warnings: string[];
  generated: Totals;
  curated: Totals;
}

export function surface(endpoints: Endpoint[], design: Design[], policy: Policy): Surface {
  throw new Unimplemented('surface');
}
