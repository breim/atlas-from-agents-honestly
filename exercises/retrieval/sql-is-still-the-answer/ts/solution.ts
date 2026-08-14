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
  const rowLimit = Math.min(request.limit ?? rails.maxRowLimit, rails.maxRowLimit);
  const applied = {
    timeoutMs: rails.timeoutMs,
    // Enforced here, not requested politely inside the query.
    rowLimit,
    readOnly: rails.readOnly,
    tenantId: principal.tenantId,
  };

  const refusals: string[] = [];

  // Shape two only: the model emits a query object, never a query.
  if (request.rawSql !== undefined) refusals.push('raw sql is not accepted');

  for (const name of Object.keys(request.filters ?? {})) {
    if (rails.reservedFilters.includes(name)) refusals.push(`${name} is decided by the compiler`);
  }

  const metric = layer.metrics[request.metric];
  if (!metric) refusals.push(`unknown metric: ${request.metric}`);

  for (const name of request.dimensions) {
    if (!layer.dimensions[name]) refusals.push(`unknown dimension: ${name}`);
  }

  const period = layer.periods[request.period];
  if (!period) refusals.push(`unknown period: ${request.period}`);

  // A refusal costs a few minutes. A confident wrong number goes in a quarterly report.
  if (refusals.length > 0) return { status: 'refused', sql: null, params: [], refusals, applied };

  const selected = [
    ...request.dimensions.map((name) => `${layer.dimensions[name].sql} AS ${name}`),
    `${metric.sql} AS ${request.metric}`,
  ].join(', ');

  const where = [
    // Appended by the compiler, never written by the model.
    'tenant_id = $1',
    ...metric.filters,
    `${metric.timeColumn} >= $2`,
    `${metric.timeColumn} < $3`,
  ].join(' AND ');

  const positions = request.dimensions.map((_, index) => index + 1).join(', ');
  const grouping = request.dimensions.length > 0 ? ` GROUP BY ${positions} ORDER BY ${positions}` : '';

  return {
    status: 'compiled',
    sql: `SELECT ${selected} FROM ${metric.from} WHERE ${where}${grouping} LIMIT ${rowLimit}`,
    params: [principal.tenantId, period.from, period.to],
    refusals,
    applied,
  };
}
