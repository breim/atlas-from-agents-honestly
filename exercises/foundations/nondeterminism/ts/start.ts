import { Unimplemented } from '#harness';

export interface Analysis {
  modal: string | null;
  modalCount: number;
  samples: number;
  agreementBps: number;
  stable: boolean;
}

export function analyse(_samples: string[], _consensusBps: number): Analysis {
  throw new Unimplemented('analyse');
}
