import { Unimplemented } from '#harness';

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

export function plan(graph: Graph, runtime: Runtime): Report {
  throw new Unimplemented('plan');
}
