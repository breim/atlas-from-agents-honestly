import { Unimplemented } from '#harness';

export interface Metric {
  sql: string;
  from: string;
  filters: string[];
  grain: string;
  timeColumn: string;
}

export interface Layer {
  metrics: Record<string, Metric>;
  dimensions: Record<string, { sql: string }>;
  periods: Record<string, { from: string; to: string }>;
}

export interface Rails {
  maxRowLimit: number;
  timeoutMs: number;
  readOnly: boolean;
  reservedFilters: string[];
}

export interface Principal {
  id: string;
  tenantId: string;
}

export interface Request {
  metric: string;
  dimensions: string[];
  period: string;
  filters?: Record<string, string>;
  limit?: number;
  rawSql?: string;
}

export interface Compiled {
  status: 'compiled' | 'refused';
  sql: string | null;
  params: string[];
  refusals: string[];
  applied: { timeoutMs: number; rowLimit: number; readOnly: boolean; tenantId: string };
}

export function compile(request: Request, layer: Layer, rails: Rails, principal: Principal): Compiled {
  throw new Unimplemented('compile');
}
