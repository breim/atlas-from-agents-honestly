export interface Node {
  name: string;
  work: 'model' | 'io' | 'interrupt' | 'pure' | 'routing' | 'subgraph';
  executeIn?: 'activity' | 'workflow';
  usesStore?: boolean;
}

export interface Edge {
  from: string;
  async: boolean;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface Runtime {
  language: 'python' | 'typescript';
  pythonVersion: string;
  usesFunctionalApi: boolean;
}

export interface Report {
  status: 'ready' | 'rejected' | 'unsupported';
  errors: string[];
  warnings: string[];
  placement: Array<{ node: string; executeIn: string }>;
  activityCount: number;
  workflowCount: number;
  checkpointer: string;
}

const ACTIVITY_WORK = ['model', 'io', 'interrupt'];

export function plan(graph: Graph, runtime: Runtime): Report {
  const errors: string[] = [];
  const warnings: string[] = [];

  // The plugin is Python-only; TypeScript writes the workflow by hand.
  if (runtime.language !== 'python') {
    return {
      status: 'unsupported',
      errors: [`the plugin is python-only; write the workflow by hand in ${runtime.language}`],
      warnings: [],
      placement: [],
      activityCount: 0,
      workflowCount: 0,
      checkpointer: 'none',
    };
  }

  const oldPython = runtime.pythonVersion < '3.11';
  const needsNewPython = runtime.usesFunctionalApi || graph.nodes.some((node) => node.work === 'interrupt');
  if (oldPython && needsNewPython) {
    // It loads with a warning rather than failing, so the pause you built is silently absent.
    warnings.push(`python ${runtime.pythonVersion} loads the plugin without interrupt or the functional API`);
  }

  for (const node of graph.nodes) {
    // execute_in cannot be defaulted, explicitly to prevent determinism bugs.
    if (!node.executeIn) {
      errors.push(`${node.name} does not declare execute_in`);
      continue;
    }
    if (ACTIVITY_WORK.includes(node.work) && node.executeIn !== 'activity') {
      errors.push(`${node.name} does ${node.work} work and must execute in an activity`);
    }
    // The Store is unreachable from an activity node, and it fails at the point of use.
    if (node.usesStore && node.executeIn === 'activity') {
      errors.push(`${node.name} reads the store from an activity, which is unreachable there`);
    }
  }

  // Conditional edges always run in the workflow, so they must be async.
  for (const edge of graph.edges) {
    if (!edge.async) errors.push(`the edge from ${edge.from} runs in the workflow and must be async`);
  }

  const placement = graph.nodes
    .filter((node) => node.executeIn)
    .map((node) => ({ node: node.name, executeIn: node.executeIn as string }));

  return {
    status: errors.length > 0 ? 'rejected' : 'ready',
    errors,
    warnings,
    placement,
    activityCount: placement.filter((item) => item.executeIn === 'activity').length,
    workflowCount: placement.filter((item) => item.executeIn === 'workflow').length,
    // Temporal's history replaces the checkpointer rather than complementing it.
    checkpointer: 'temporal-history',
  };
}
