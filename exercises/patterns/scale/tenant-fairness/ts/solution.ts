export interface QueuedTask {
  tenant: string;
  task: string;
}

export function schedule(queue: QueuedTask[]): string[] {
  const byTenant = new Map<string, string[]>();
  for (const { tenant, task } of queue) {
    byTenant.set(tenant, [...(byTenant.get(tenant) ?? []), task]);
  }

  const order: string[] = [];
  while (byTenant.size > 0) {
    for (const [tenant, tasks] of byTenant) {
      order.push(tasks.shift()!);
      if (tasks.length === 0) byTenant.delete(tenant);
    }
  }

  return order;
}
