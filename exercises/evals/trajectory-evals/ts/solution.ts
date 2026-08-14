export interface Call {
  tool: string;
  args: string;
  error: string | null;
  contributed: boolean;
}

export interface Spec {
  required: string[];
  minimumSteps: number;
  orderPolicy: Array<[string, string]>;
}

export interface Trajectory {
  recallBps: number;
  precisionBps: number;
  stepEfficiencyBps: number;
  redundantBps: number;
  loopEscapeBps: number;
  policyViolations: string[];
}

const rate = (part: number, whole: number, empty: number) =>
  whole === 0 ? empty : Math.floor((part * 10000) / whole + 0.5);

export function score(calls: Call[], spec: Spec): Trajectory {
  // Which tools, not in what order. The order a run happened to visit them in is not a fact.
  const called = [...new Set(calls.map((call) => call.tool))];
  const matched = spec.required.filter((tool) => called.includes(tool)).length;
  const needed = called.filter((tool) => spec.required.includes(tool)).length;

  const key = (call: Call) => `${call.tool} ${call.args} ${call.error}`;
  const seen = new Set<string>();
  let repeats = 0;
  for (const call of calls) {
    // A repeated success is waste; a repeated failure is a control-flow signal.
    if (call.error !== null && seen.has(key(call))) repeats += 1;
    seen.add(key(call));
  }

  const first = (tool: string) => calls.findIndex((call) => call.tool === tool);
  const policyViolations = spec.orderPolicy
    .filter(([before, after]) => first(after) !== -1 && (first(before) === -1 || first(before) > first(after)))
    .map(([before, after]) => `${before}->${after}`);

  return {
    recallBps: rate(matched, spec.required.length, 10000),
    precisionBps: rate(needed, called.length, 10000),
    stepEfficiencyBps: Math.min(10000, rate(spec.minimumSteps, calls.length, 0)),
    redundantBps: rate(calls.filter((call) => !call.contributed).length, calls.length, 0),
    loopEscapeBps: 10000 - rate(repeats, calls.length, 0),
    policyViolations,
  };
}
