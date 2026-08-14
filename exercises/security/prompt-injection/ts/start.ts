import { Unimplemented } from '#harness';

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
  throw new Unimplemented('assess');
}
