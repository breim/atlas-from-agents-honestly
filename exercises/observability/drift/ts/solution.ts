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
  const signals: Array<[string, boolean]> = [
    ['deploy', window.deployed],
    ['canary', window.canaryScoreDeltaBps <= -thresholds.canaryDropBps],
    ['chunk_turnover', window.citedChunkTurnoverBps >= thresholds.chunkTurnoverBps],
    ['input_centroid', window.inputCentroidShiftBps >= thresholds.centroidShiftBps],
    ['eval_score', window.evalScoreDeltaBps <= -thresholds.evalDropBps],
    ['format_compliance', window.formatComplianceDeltaBps <= -thresholds.formatDropBps],
  ];
  const tripped = signals.filter(([, fired]) => fired).map(([name]) => name);
  const fired = (name: string) => tripped.includes(name);

  // The deploy log first, because it is the most common answer and the last one checked.
  if (fired('deploy')) return { cause: 'check_the_deploy_log', tripped };

  // Frozen inputs and a pinned config leave only the provider.
  if (fired('canary')) return { cause: 'provider_behavior_changed', tripped };

  if (fired('chunk_turnover')) return { cause: 'corpus_moved', tripped };

  // Either half alone has a base rate too high to page on. The conjunction does not.
  if (fired('input_centroid') && fired('eval_score')) {
    return { cause: 'input_distribution_changed', tripped };
  }

  if (fired('format_compliance')) return { cause: 'output_shape_changed', tripped };

  return { cause: null, tripped };
}
