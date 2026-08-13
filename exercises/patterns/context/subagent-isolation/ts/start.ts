import { Unimplemented } from '#harness';

export type Context = Record<string, unknown>;

export function isolate(_parent: Context, _allow: string[]): Context {
  throw new Unimplemented('isolate');
}

export function merge(_parent: Context, _result: Context, _expose: string[]): Context {
  throw new Unimplemented('merge');
}
