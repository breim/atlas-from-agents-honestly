import { Unimplemented } from '#harness';

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

export function apply(_signals: Signal[]): Entity {
  throw new Unimplemented('apply');
}
