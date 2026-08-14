export interface Predicate {
  field: string;
  equals?: unknown;
  atLeast?: number;
}

export interface Router {
  from: string;
  destinations: string[];
  branches: Array<{ when: Predicate; to: string }>;
  otherwise?: string;
  fanOut?: string[];
  join?: string;
}

export interface Node {
  name: string;
  kind: 'node' | 'subgraph';
  graph?: string;
  mode?: 'shared' | 'transformed';
  passes?: string[];
  returns?: string[];
}

export interface Graph {
  entry: string;
  loop: { bound: number; superStepsPerPass: number } | null;
  reducers: Record<string, 'sum' | 'concat'>;
  nodes: Node[];
  edges: Array<{ from: string; to: string }>;
  routers: Router[];
}

export type State = Record<string, unknown>;

export interface Config {
  transcriptFields: string[];
  backstop: number;
}

export interface View {
  node: string;
  saw: string[];
  returned: string[];
}

export interface Run {
  status: 'completed' | 'halted' | 'crashed' | 'invalid';
  errors: string[];
  path: string[];
  superSteps: number;
  state: State;
  views: View[];
}

const END = 'END';

function validate(graph: Graph, config: Config): string[] {
  const errors: string[] = [];

  for (const router of graph.routers) {
    const targets = [
      ...router.branches.map((branch) => branch.to),
      ...(router.otherwise ? [router.otherwise] : []),
      ...(router.fanOut ?? []),
    ];
    for (const target of targets) {
      // The declared list is what makes the graph statically analysable.
      if (!router.destinations.includes(target)) {
        errors.push(`router at ${router.from} may return only ${router.destinations.join(', ')} — not ${target}`);
      }
    }
    for (const branch of router.branches) {
      // A conditional edge reads decision state and nothing else.
      if (config.transcriptFields.includes(branch.when.field)) {
        errors.push(`router at ${router.from} reads ${branch.when.field}, which is transcript state`);
      }
    }
  }

  if (graph.loop) {
    const owed = graph.loop.bound * graph.loop.superStepsPerPass;
    // The backstop counts super-steps, so it has to sit above the bound you wrote.
    if (owed >= config.backstop) {
      errors.push(`the backstop at ${config.backstop} fires before the semantic bound at ${owed} super-steps`);
    }
  }

  return errors;
}

const holds = (predicate: Predicate, state: State) => {
  const value = state[predicate.field];
  if (predicate.atLeast !== undefined) return typeof value === 'number' && value >= predicate.atLeast;
  return value === predicate.equals;
};

function merge(state: State, update: State, reducers: Graph['reducers']): State {
  const merged: State = { ...state };
  for (const [field, value] of Object.entries(update)) {
    const reducer = reducers[field];
    if (reducer === 'sum') merged[field] = ((merged[field] as number) ?? 0) + (value as number);
    else if (reducer === 'concat') merged[field] = [...((merged[field] as unknown[]) ?? []), ...(value as unknown[])];
    else merged[field] = value;
  }
  return merged;
}

export function run(graph: Graph, input: State, updates: Record<string, State[]>, subUpdates: Record<string, State[]>, config: Config): Run {
  const errors = validate(graph, config);
  if (errors.length > 0) {
    return { status: 'invalid', errors, path: [], superSteps: 0, state: input, views: [] };
  }

  const remaining: Record<string, State[]> = {};
  for (const [name, list] of Object.entries(updates)) remaining[name] = [...list];
  const remainingSub: Record<string, State[]> = {};
  for (const [name, list] of Object.entries(subUpdates)) remainingSub[name] = [...list];

  let state: State = { ...input };
  const path: string[] = [];
  const views: View[] = [];
  let position = graph.entry;
  let superSteps = 0;

  const nodeOf = (name: string) => graph.nodes.find((node) => node.name === name) as Node;

  const visit = (name: string) => {
    path.push(name);
    superSteps += 1;
    state = merge(state, { step: (state.step as number ?? 0) + 1 }, graph.reducers);

    const node = nodeOf(name);
    if (node?.kind === 'subgraph') {
      const shared = node.mode === 'shared';
      // Transformed: the subgraph cannot see the parent's transcript, because it isn't in its state.
      const passed: State = shared
        ? { ...state }
        : Object.fromEntries((node.passes ?? []).map((field) => [field, state[field]]));
      const update = remainingSub[node.graph as string]?.shift() ?? {};
      const produced = merge(passed, update, graph.reducers);
      const returned = shared ? Object.keys(update) : (node.returns ?? []).filter((field) => field in produced);
      for (const field of returned) state[field] = produced[field];
      views.push({ node: name, saw: Object.keys(passed).sort(), returned: [...returned].sort() });
      return;
    }

    const update = remaining[name]?.shift();
    if (update) state = merge(state, update, graph.reducers);
  };

  while (superSteps < config.backstop) {
    visit(position);
    // The semantic bound produces a result you can report, not a stack trace.
    if (position === 'halt') return { status: 'halted', errors: [], path, superSteps, state, views };

    const router = graph.routers.find((item) => item.from === position);
    if (router?.fanOut) {
      for (const branch of router.fanOut) visit(branch);
      position = router.join as string;
      continue;
    }

    let next: string;
    if (router) {
      const taken = router.branches.find((branch) => holds(branch.when, state));
      next = taken ? taken.to : (router.otherwise as string);
    } else {
      const edge = graph.edges.find((item) => item.from === position);
      next = edge ? edge.to : END;
    }
    if (next === END) return { status: 'completed', errors: [], path, superSteps, state, views };
    position = next;
  }

  // Hitting the framework limit is an exception, not an outcome.
  return {
    status: 'crashed',
    errors: [`backstop fired after ${superSteps} super-steps`],
    path,
    superSteps,
    state,
    views,
  };
}
