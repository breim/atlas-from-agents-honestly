export interface Read {
  source: string;
  trust: 'trusted' | 'untrusted';
  private: boolean;
}

export interface Path {
  ticket: { id: string; orderId: string; customerEmail: string };
  reads: Read[];
  call: { tool: string; orderId: string; amountCents: number; recipient: string | null };
}

export interface Tool {
  class: number;
  exfiltrates: boolean;
}

export interface Config {
  maxClassWhenTainted: number;
  tier0CapCents: number;
}

export interface Verdict {
  tainted: boolean;
  sources: string[];
  trifecta: { privateData: boolean; untrustedContent: boolean; exfiltration: boolean };
  lethal: boolean;
  admitted: boolean;
  reason: string | null;
  escalate: boolean;
}

export function assess(path: Path, catalogue: Record<string, Tool>, config: Config): Verdict {
  const tool = catalogue[path.call.tool];

  // Assigned by where the bytes came from. There is no detection step to evade.
  const sources = path.reads.filter((read) => read.trust === 'untrusted').map((read) => read.source);
  const tainted = sources.length > 0;

  const trifecta = {
    privateData: path.reads.some((read) => read.private),
    untrustedContent: tainted,
    exfiltration: tool.exfiltrates,
  };
  // Reported, never enforced. A path can hold all three and still be safe.
  const lethal = trifecta.privateData && trifecta.untrustedContent && trifecta.exfiltration;

  const shared = { tainted, sources, trifecta, lethal };
  const deny = (reason: string) => ({ ...shared, admitted: false, reason, escalate: true });

  // A control rather than a response to taint: the address comes from the record.
  if (tool.exfiltrates && path.call.recipient !== path.ticket.customerEmail) {
    return deny('recipient_not_from_record');
  }

  if (!tainted || tool.class <= config.maxClassWhenTainted) {
    return { ...shared, admitted: true, reason: null, escalate: false };
  }

  // Above the ceiling a tainted run needs a narrow, argument-constrained call.
  const scoped = path.call.orderId === path.ticket.orderId && path.call.amountCents <= config.tier0CapCents;
  if (scoped) return { ...shared, admitted: true, reason: null, escalate: false };

  return deny('class_above_taint_ceiling');
}
