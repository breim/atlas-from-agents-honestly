import { Unimplemented } from '#harness';

export interface Record {
  id: string;
  version: number;
}

export interface Snapshot {
  complete: boolean;
  records: Record[];
}

export interface Reconciliation {
  missing: string[];
  stale: string[];
  ahead: string[];
  extra: string[];
  inSync: boolean;
}

export function reconcile(snapshot: Snapshot, projection: Record[]): Reconciliation {
  throw new Unimplemented('reconcile');
}
