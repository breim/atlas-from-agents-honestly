export interface Request {
  kind: 'op' | 'egress' | 'secret';
  op?: string;
  orderId?: string;
  amountCents?: number;
  host?: string;
  name?: string;
  outputBytes: number;
}

export interface Policy {
  egressAllow: string[];
  maxOutputBytes: number;
  catalogue: Record<string, { class: number }>;
}

export interface Scope {
  maxClass: number;
  orderId: string;
  capCents: number;
}

export interface Result {
  allowed: boolean;
  reason: string | null;
  alerted: boolean;
  deliveredBytes: number;
  truncated: boolean;
}

const deny = (reason: string, alerted: boolean): Result => ({
  allowed: false,
  reason,
  alerted,
  deliveredBytes: 0,
  truncated: false,
});

export function handle(request: Request, scope: Scope, policy: Policy): Result {
  // There is no getSecret. It was never implemented, and asking is a signal.
  if (request.kind === 'secret') return deny('no_such_capability', true);

  if (request.kind === 'egress') {
    // Default deny. A blocked connection to an unexpected host is the detection.
    if (!policy.egressAllow.includes(request.host!)) return deny('egress_denied', true);
  } else {
    // The same authorization the tool dispatcher runs, so generated code reaches
    // nothing the model could not have called directly.
    const tool = policy.catalogue[request.op!];
    if (!tool) return deny('unknown_operation', false);
    if (tool.class > scope.maxClass) return deny('not_authorized', false);
    if (request.orderId !== scope.orderId || request.amountCents! > scope.capCents) {
      return deny('out_of_scope', false);
    }
  }

  // Output becomes tool results, which become prompt text. Clip it here.
  const truncated = request.outputBytes > policy.maxOutputBytes;
  return {
    allowed: true,
    reason: null,
    alerted: false,
    deliveredBytes: truncated ? policy.maxOutputBytes : request.outputBytes,
    truncated,
  };
}
