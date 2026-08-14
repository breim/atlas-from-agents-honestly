export interface Task {
  id: string;
  priority: number;
  tenant: string;
}

const roundRobin = (level: Task[], weights: Record<string, number>): string[] => {
  const turns = [...new Set(level.map((task) => task.tenant))];
  const backlogs = new Map(turns.map((tenant) => [tenant, level.filter((task) => task.tenant === tenant)]));
  const dispatched: string[] = [];

  while (dispatched.length < level.length) {
    for (const tenant of turns) {
      const backlog = backlogs.get(tenant)!;
      // A tenant with nothing left is skipped, not waited for.
      for (let turn = 0; turn < (weights[tenant] ?? 1) && backlog.length > 0; turn += 1) {
        dispatched.push(backlog.shift()!.id);
      }
    }
  }

  return dispatched;
};

export function dispatch(tasks: Task[], weights: Record<string, number>): string[] {
  const levels = [...new Set(tasks.map((task) => task.priority))].sort((a, b) => a - b);
  return levels.flatMap((priority) =>
    roundRobin(
      tasks.filter((task) => task.priority === priority),
      weights,
    ),
  );
}
