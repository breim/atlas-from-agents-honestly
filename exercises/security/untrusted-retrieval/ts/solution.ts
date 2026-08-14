export interface Chunk {
  id: string;
  provenance: 'first-party' | 'vendor' | 'customer-writable' | 'inferred';
  writers: string[];
  contentHash: string;
  ingestedHash: string;
  competesFor: string[];
}

export interface Task {
  name: string;
  authority: 'high' | 'low';
  query: string;
}

export interface Policy {
  highAuthorityProvenance: string[];
  requireCitations: boolean;
}

export interface Retrieved {
  status: 'served' | 'refused';
  errors: string[];
  chunks: string[];
  tainted: boolean;
  citations: string[];
  competingForQuery: number;
  poisonRatioBps: number;
  drifted: string[];
  writers: string[];
}

export function retrieve(chunks: Chunk[], task: Task, policy: Policy): Retrieved {
  const errors: string[] = [];

  // Provenance is a column the loader assigns, never inferred from content.
  const inferred = chunks.filter((chunk) => chunk.provenance === 'inferred');
  for (const chunk of inferred) errors.push(`${chunk.id} has provenance inferred from its content`);

  // A vendor page that turns hostile after ingestion is otherwise a silent change.
  const drifted = chunks.filter((chunk) => chunk.contentHash !== chunk.ingestedHash).map((chunk) => chunk.id);
  for (const id of drifted) errors.push(`${id} changed since it was ingested`);

  const competing = chunks.filter((chunk) => chunk.competesFor.includes(task.query));

  // High-authority workflows never read attacker-writable text.
  const forbidden = competing.filter((chunk) => !policy.highAuthorityProvenance.includes(chunk.provenance));
  if (task.authority === 'high' && forbidden.length > 0) {
    for (const chunk of forbidden) {
      errors.push(`${task.name} is high authority and ${chunk.id} is ${chunk.provenance}`);
    }
  }

  if (policy.requireCitations && competing.length === 0) {
    errors.push(`${task.name} requires citations and nothing competes for its query`);
  }

  if (errors.length > 0) {
    return {
      status: 'refused',
      errors,
      chunks: [],
      tainted: false,
      citations: [],
      competingForQuery: competing.length,
      poisonRatioBps: 0,
      drifted,
      writers: [],
    };
  }

  // The ratio that matters is poisoned over what competes for that query, not over the corpus.
  const poisoned = competing.filter((chunk) => chunk.provenance === 'customer-writable').length;
  const poisonRatioBps = competing.length === 0 ? 0 : Math.floor((poisoned * 10000) / competing.length + 0.5);

  // A corpus is the merge of every writer who ever had access to any of its sources.
  const writers = [...new Set(competing.flatMap((chunk) => chunk.writers))].sort();

  return {
    status: 'served',
    errors,
    chunks: competing.map((chunk) => chunk.id),
    // An external chunk taints the run exactly as a customer ticket does.
    tainted: competing.some((chunk) => chunk.provenance !== 'first-party'),
    citations: competing.map((chunk) => chunk.id),
    competingForQuery: competing.length,
    poisonRatioBps,
    drifted,
    writers,
  };
}
