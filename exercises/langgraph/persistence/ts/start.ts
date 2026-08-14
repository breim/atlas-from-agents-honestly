import { Unimplemented } from '#harness';

export interface Effect {
  name: string;
  discriminator?: string;
  readOnly?: boolean;
  random?: boolean;
  approval?: boolean;
}

export interface Graph {
  nodes: Array<{ name: string; effects: Effect[] }>;
}

export interface Thread {
  id: string;
  holdsLease: boolean;
  crashes: Array<{ node: string; afterEffect: number }>;
}

export interface Store {
  effects: Record<string, number>;
}

export interface Config {
  requireLease: boolean;
  autoResume: boolean;
  maxNodeEntries: number;
}

export interface Applied {
  node: string;
  effect: string;
  key: string | null;
  deduped: boolean;
}

export interface Run {
  status: 'completed' | 'stopped' | 'refused';
  path: string[];
  checkpoints: string[];
  applied: Applied[];
  duplicated: string[];
  store: Store;
}

export function execute(graph: Graph, thread: Thread, store: Store, config: Config): Run {
  throw new Unimplemented('execute');
}
