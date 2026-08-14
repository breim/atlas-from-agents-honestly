import { Unimplemented } from '#harness';

export interface Task {
  id: string;
  priority: number;
  tenant: string;
}

export function dispatch(tasks: Task[], weights: Record<string, number>): string[] {
  throw new Unimplemented('dispatch');
}
