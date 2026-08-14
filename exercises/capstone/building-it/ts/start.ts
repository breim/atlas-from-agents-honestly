import { Unimplemented } from '#harness';

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
  throw new Unimplemented('review');
}
