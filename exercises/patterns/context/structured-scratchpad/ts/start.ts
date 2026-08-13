import { Unimplemented } from '#harness';

export interface Write {
  key: string;
  value: string;
}

export function render(_writes: Write[]): string {
  throw new Unimplemented('render');
}
