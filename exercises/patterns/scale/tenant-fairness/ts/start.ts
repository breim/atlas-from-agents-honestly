import { Unimplemented } from '#harness';

export interface QueuedTask {
  tenant: string;
  task: string;
}

export function schedule(_queue: QueuedTask[]): string[] {
  throw new Unimplemented('schedule');
}
