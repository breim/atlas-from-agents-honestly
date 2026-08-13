import { Unimplemented } from '#harness';

export interface Task {
  task: string;
  priority: number;
}

export function order(_tasks: Task[]): string[] {
  throw new Unimplemented('order');
}
