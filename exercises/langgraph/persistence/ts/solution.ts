export interface Effect {
  name: string;
  discriminator?: string;
  readOnly?: boolean;
  random?: boolean;
  approval?: boolean;
}

export interface Graph {
  nodes: Array<{ name: string; effects: Effect[] }>;
}

export interface Thread {
  id: string;
  holdsLease: boolean;
  crashes: Array<{ node: string; afterEffect: number }>;
}

export interface Store {
  effects: Record<string, number>;
}

export interface Config {
  requireLease: boolean;
  autoResume: boolean;
  maxNodeEntries: number;
}

export interface Applied {
  node: string;
  effect: string;
  key: string | null;
  deduped: boolean;
}

export interface Run {
  status: 'completed' | 'stopped' | 'refused';
  path: string[];
  checkpoints: string[];
  applied: Applied[];
  duplicated: string[];
  store: Store;
}

export function execute(graph: Graph, thread: Thread, store: Store, config: Config): Run {
  // Nothing in a checkpointer coordinates two workers. The lease is yours to build.
  if (config.requireLease && !thread.holdsLease) {
    return { status: 'refused', path: [], checkpoints: [], applied: [], duplicated: [], store };
  }

  const effects: Record<string, number> = { ...store.effects };
  const crashes = [...thread.crashes];
  const answered = new Set<string>();
  const path: string[] = [];
  const checkpoints: string[] = [];
  const applied: Applied[] = [];
  let nonce = 0;
  let index = 0;
  let status: Run['status'] = 'completed';

  while (index < graph.nodes.length) {
    // A hard backstop on node entries. A correct run never comes near it.
    if (path.length >= config.maxNodeEntries) {
      status = 'stopped';
      break;
    }
    const node = graph.nodes[index];
    path.push(node.name);
    let crashed = false;
    let paused = false;

    for (const [position, effect] of node.effects.entries()) {
      if (effect.approval) {
        // The interrupted call returns its recorded result; everything else runs again.
        if (answered.has(`${node.name}:${effect.name}`)) {
          applied.push({ node: node.name, effect: effect.name, key: null, deduped: true });
          continue;
        }
        applied.push({ node: node.name, effect: effect.name, key: null, deduped: false });
        answered.add(`${node.name}:${effect.name}`);
        paused = true;
        break;
      }

      // Derived from the thread, so a replay produces the same key. A random one does not.
      const key = effect.readOnly
        ? null
        : effect.random
          ? `${thread.id}:${node.name}:${effect.name}:rnd-${nonce++}`
          : `${thread.id}:${node.name}:${effect.name}:${effect.discriminator}`;

      const deduped = key !== null && key in effects;
      if (key !== null && !deduped) effects[key] = 1;
      applied.push({ node: node.name, effect: effect.name, key, deduped });

      const crash = crashes[0];
      if (crash && crash.node === node.name && crash.afterEffect === position) {
        crashes.shift();
        crashed = true;
        break;
      }
    }

    // No checkpoint was written, so a resume restarts at the beginning of the node.
    if (crashed) {
      if (!config.autoResume) {
        status = 'stopped';
        break;
      }
      continue;
    }
    if (paused) continue;

    checkpoints.push(node.name);
    index += 1;
  }

  const landed = applied.filter((item) => !item.deduped && item.key !== null).map((item) => item.effect);
  const duplicated = [...new Set(landed.filter((name) => landed.filter((other) => other === name).length > 1))];

  return { status, path, checkpoints, applied, duplicated, store: { effects } };
}
