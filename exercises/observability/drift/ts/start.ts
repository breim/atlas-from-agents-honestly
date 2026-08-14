import { Unimplemented } from '#harness';

export interface Window {
  deployed: boolean;
  canaryScoreDeltaBps: number;
  citedChunkTurnoverBps: number;
  inputCentroidShiftBps: number;
  evalScoreDeltaBps: number;
  formatComplianceDeltaBps: number;
}

export interface Thresholds {
  canaryDropBps: number;
  chunkTurnoverBps: number;
  centroidShiftBps: number;
  evalDropBps: number;
  formatDropBps: number;
}

export interface Diagnosis {
  cause: string | null;
  tripped: string[];
}

export function diagnose(window: Window, thresholds: Thresholds): Diagnosis {
  throw new Unimplemented('diagnose');
}
