import { Unimplemented } from '#harness';

export type Reversibility = 'reversible' | 'costly' | 'irreversible';
export type Posture = 'auto' | 'notify' | 'approve' | 'dual';

export interface Tool {
  reversibility: Reversibility;
  templatedReversibility?: Reversibility;
  radiusThresholds: number[];
}

export interface Call {
  tool: string;
  scope: number;
  templated: boolean;
  count: number;
}

export interface Assessment {
  decisions: Array<{ tool: string; posture: Posture }>;
  approvals: number;
  affordable: boolean;
}

export function assess(
  calls: Call[],
  catalogue: Record<string, Tool>,
  capacity: number,
): Assessment {
  throw new Unimplemented('assess');
}
