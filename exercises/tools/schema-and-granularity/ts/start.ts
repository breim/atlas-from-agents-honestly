import { Unimplemented } from '#harness';

export interface Param {
  name: string;
  required: boolean;
}

export interface Tool {
  name: string;
  effects: string[];
  params: Param[];
}

export interface Assessment {
  verdict: 'ok' | 'revise';
  issues: string[];
}

export function assess(_tool: Tool, _knownFields: string[], _maxParams: number): Assessment {
  throw new Unimplemented('assess');
}
