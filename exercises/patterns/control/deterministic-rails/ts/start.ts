import { Unimplemented } from '#harness';

export interface Rail {
  when: string;
  answer: string;
}

export interface Request {
  intent?: string;
}

export interface Handled {
  answer: string;
  source: 'rail' | 'model';
  modelCalls: number;
}

export function handle(
  _request: Request,
  _rails: Rail[],
  _model: (request: Request) => string,
): Handled {
  throw new Unimplemented('handle');
}
