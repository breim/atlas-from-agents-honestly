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
  const local = new Map(projection.map((record) => [record.id, record.version]));

  const missing: string[] = [];
  const stale: string[] = [];
  const ahead: string[] = [];

  for (const record of snapshot.records) {
    const version = local.get(record.id);
    if (version === undefined) missing.push(record.id);
    else if (version < record.version) stale.push(record.id);
    else if (version > record.version) ahead.push(record.id);
  }

  // A partial listing proves what exists, never what does not. Deleting on the strength of
  // a page that failed to arrive is how reconciliation destroys the replica it repairs.
  const source = new Set(snapshot.records.map((record) => record.id));
  const extra = snapshot.complete
    ? projection.filter((record) => !source.has(record.id)).map((record) => record.id)
    : [];

  const clean = !missing.length && !stale.length && !ahead.length && !extra.length;

  return { missing, stale, ahead, extra, inSync: snapshot.complete && clean };
}
