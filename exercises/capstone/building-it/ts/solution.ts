export interface Tool {
  name: string;
  klass: 1 | 2 | 3 | 4 | 5;
  args: string[];
  derives: string[];
  pairedRead: string | null;
}

export interface Question {
  id: string;
  kind: 'semantic' | 'aggregation' | 'relationship' | 'live-state';
}

export interface Node {
  name: string;
  work: 'decide' | 'model' | 'tool';
  placement: 'workflow' | 'activity';
}

export interface Build {
  tools: Tool[];
  nodes: Node[];
  workflowId: string;
  tenantId: string;
  corpusSplitByTrust: boolean;
}

export interface Policy {
  maxTools: number;
  forbiddenArgs: string[];
  routes: Record<string, string>;
  buildOrder: string[];
}

export interface Review {
  status: 'shippable' | 'blocked';
  errors: string[];
  routing: Array<{ question: string; retriever: string | null }>;
  activities: number;
  workflowNodes: number;
}

export function review(build: Build, questions: Question[], policy: Policy): Review {
  const errors: string[] = [];

  // Nine tools, not nineteen. Every tool is a permission and every description is prompt text.
  if (build.tools.length > policy.maxTools) {
    errors.push(`${build.tools.length} tools exceeds the ${policy.maxTools} the catalogue can carry`);
  }

  for (const tool of build.tools) {
    // Removing a parameter beats validating one.
    for (const argument of tool.args) {
      if (policy.forbiddenArgs.includes(argument)) {
        errors.push(`${tool.name} takes ${argument}, which should be derived rather than validated`);
      }
    }
    // Every class 4-5 tool ships with a paired read, or unknown is permanently unresolvable.
    if (tool.klass >= 4 && !tool.pairedRead) {
      errors.push(`${tool.name} is class ${tool.klass} and ships no paired read`);
    }
  }

  // Model calls and tool calls are always activities; workflow code decides.
  for (const node of build.nodes) {
    if (node.work === 'decide' && node.placement !== 'workflow') {
      errors.push(`${node.name} decides and should be workflow code`);
    }
    if (node.work !== 'decide' && node.placement !== 'activity') {
      errors.push(`${node.name} does ${node.work} work and must be an activity`);
    }
  }

  // The poisoned article can still rank first and still cannot reach a write tool.
  if (!build.corpusSplitByTrust) errors.push('the corpus is not split by trust');

  // Put the tenant in the workflow id: structural tenancy and queue routing in one decision.
  if (!build.workflowId.includes(build.tenantId)) {
    errors.push('the workflow id does not carry the tenant');
  }

  // Route before retrieving: four systems, four strategies.
  const routing = questions.map((question) => ({
    question: question.id,
    retriever: policy.routes[question.kind] ?? null,
  }));
  for (const route of routing) {
    if (!route.retriever) errors.push(`${route.question} has no retriever for its kind`);
  }

  return {
    status: errors.length > 0 ? 'blocked' : 'shippable',
    errors,
    routing,
    activities: build.nodes.filter((node) => node.placement === 'activity').length,
    workflowNodes: build.nodes.filter((node) => node.placement === 'workflow').length,
  };
}
