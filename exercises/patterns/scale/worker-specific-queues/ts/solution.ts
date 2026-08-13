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

export function route(tasks: Task[], queues: Queue[]): Routing {
  const routing: Routing = { routed: {}, unroutable: [] };

  for (const task of tasks) {
    const queue = queues.find((candidate) =>
      task.needs.every((need) => candidate.provides.includes(need)),
    );

    if (!queue) {
      routing.unroutable.push(task.task);
      continue;
    }

    (routing.routed[queue.name] ??= []).push(task.task);
  }

  return routing;
}
