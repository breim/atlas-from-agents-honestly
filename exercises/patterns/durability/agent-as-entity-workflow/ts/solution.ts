export interface Signal {
  id: string;
  kind: string;
  value: string;
}

export interface Entity {
  notes: string[];
  applied: string[];
  ignored: string[];
}

export function apply(signals: Signal[]): Entity {
  const entity: Entity = { notes: [], applied: [], ignored: [] };
  const seen = new Set<string>();

  for (const signal of signals) {
    if (seen.has(signal.id) || signal.kind !== 'note') {
      entity.ignored.push(signal.id);
      continue;
    }

    seen.add(signal.id);
    entity.applied.push(signal.id);
    entity.notes.push(signal.value);
  }

  return entity;
}
