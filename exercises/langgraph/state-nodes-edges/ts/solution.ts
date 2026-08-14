export interface Predicate {
  field: string;
  equals?: unknown;
  atLeast?: number;
}

export interface Branch {
  when: Predicate;
  to: string;
}

export interface ConditionalEdge {
  from: string;
  branches: Branch[];
  otherwise: string;
}

export interface Spec {
  entry: string;
  nodes: Array<{ name: string; kind: 'model' | 'code' }>;
  edges: Array<{ from: string; to: string }>;
  conditionalEdges: ConditionalEdge[];
}

export type State = Record<string, unknown>;

export interface Limits {
  maxSteps: number;
}

export interface Run {
  status: 'completed' | 'halted' | 'invalid';
  errors: string[];
  path: string[];
  position: string;
  state: State;
}

const END = 'END';

function targetsOf(spec: Spec, name: string): string[] {
  const conditional = spec.conditionalEdges.find((edge) => edge.from === name);
  if (conditional) return [...conditional.branches.map((branch) => branch.to), conditional.otherwise];
  const edge = spec.edges.find((item) => item.from === name);
  return edge ? [edge.to] : [];
}

// compile() runs before anything executes. These are the bugs a while loop could not detect.
function validate(spec: Spec): string[] {
  const names = new Set(spec.nodes.map((node) => node.name));
  const known = (name: string) => name === END || names.has(name);

  const dangling: string[] = [];
  for (const edge of spec.edges) {
    if (!known(edge.to)) dangling.push(`edge ${edge.from} -> ${edge.to} names a node that does not exist`);
  }
  for (const edge of spec.conditionalEdges) {
    for (const target of [...edge.branches.map((branch) => branch.to), edge.otherwise]) {
      if (!known(target)) dangling.push(`edge ${edge.from} -> ${target} names a node that does not exist`);
    }
  }
  if (dangling.length > 0) return dangling;

  const errors: string[] = [];
  const reachable = new Set<string>();
  const walk = (name: string) => {
    if (name === END || reachable.has(name)) return;
    reachable.add(name);
    for (const target of targetsOf(spec, name)) walk(target);
  };
  walk(spec.entry);

  for (const node of spec.nodes) {
    if (!reachable.has(node.name)) errors.push(`node ${node.name} is unreachable from ${spec.entry}`);
  }

  const ends = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of spec.nodes) {
      if (ends.has(node.name)) continue;
      if (targetsOf(spec, node.name).some((target) => target === END || ends.has(target))) {
        ends.add(node.name);
        grew = true;
      }
    }
  }
  for (const node of spec.nodes) {
    if (!ends.has(node.name)) errors.push(`node ${node.name} has no path to END`);
  }

  return errors;
}

// A plain predicate over state. There is nowhere in here for a model to sit.
function holds(predicate: Predicate, state: State): boolean {
  const value = state[predicate.field];
  if (predicate.atLeast !== undefined) return typeof value === 'number' && value >= predicate.atLeast;
  return value === predicate.equals;
}

function nextOf(spec: Spec, name: string, state: State): string {
  const conditional = spec.conditionalEdges.find((edge) => edge.from === name);
  if (conditional) {
    const taken = conditional.branches.find((branch) => holds(branch.when, state));
    return taken ? taken.to : conditional.otherwise;
  }
  const edge = spec.edges.find((item) => item.from === name);
  return edge ? edge.to : END;
}

export function execute(spec: Spec, input: State, updates: Record<string, State[]>, limits: Limits): Run {
  const errors = validate(spec);
  if (errors.length > 0) {
    return { status: 'invalid', errors, path: [], position: spec.entry, state: input };
  }

  const remaining: Record<string, State[]> = {};
  for (const [name, list] of Object.entries(updates)) remaining[name] = [...list];

  let state: State = { ...input };
  const path: string[] = [];
  let position = spec.entry;

  for (let step = 0; step < limits.maxSteps; step += 1) {
    path.push(position);
    // A node returns the keys it changed, and the framework merges them in.
    const update = remaining[position]?.shift();
    if (update) state = { ...state, ...update };

    const next = nextOf(spec, position, state);
    if (next === END) {
      return { status: 'completed', errors: [], path, position: END, state };
    }
    position = next;
  }

  return { status: 'halted', errors: [], path, position, state };
}
