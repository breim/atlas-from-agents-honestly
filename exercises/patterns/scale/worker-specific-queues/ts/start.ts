import { Unimplemented } from '#harness';

export interface Queue {
  name: string;
  provides: string[];
}

export interface Task {
  task: string;
  needs: string[];
}

export interface Routing {
  routed: Record<string, string[]>;
  unroutable: string[];
}

export function route(_tasks: Task[], _queues: Queue[]): Routing {
  throw new Unimplemented('route');
}
