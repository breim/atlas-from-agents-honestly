import { Unimplemented } from '#harness';

export interface Principal {
  principal: string;
  scopes: string[];
}

export interface Act {
  allowed: boolean;
  principal: string | null;
  reason: string | null;
}

export function act(_user: Principal | null, _need: string, _service: Principal): Act {
  throw new Unimplemented('act');
}
