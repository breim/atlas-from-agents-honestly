export interface Task {
  task: string;
  priority: number;
}

export function order(tasks: Task[]): string[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => b.task.priority - a.task.priority || a.index - b.index)
    .map(({ task }) => task.task);
}
