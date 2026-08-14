export interface Block {
  id: string;
  kind: string;
  level?: number;
  tokens: number;
  text: string;
}

export interface Document {
  documentId: string;
  version: number;
  blocks: Block[];
}

export interface Config {
  maxChildTokens: number;
  neverStartsAChunk: string[];
  strategy: 'structural' | 'fixed';
}

export interface Parent {
  id: string;
  documentId: string;
  version: number;
  trail: string[];
  tokens: number;
  blockIds: string[];
}

export interface Child extends Parent {
  parentId: string;
}

export interface Chunked {
  parents: Parent[];
  children: Child[];
}

const sum = (blocks: Block[]) => blocks.reduce((total, block) => total + block.tokens, 0);

export function chunk(document: Document, config: Config): Chunked {
  // Parents are the document's own sections, so the author decides where they begin.
  const sections: Array<{ trail: string[]; blocks: Block[] }> = [];
  let trail: string[] = [];

  for (const block of document.blocks) {
    if (block.kind === 'heading') {
      trail = [...trail.slice(0, (block.level as number) - 1), block.text];
      sections.push({ trail: [...trail], blocks: [block] });
      continue;
    }
    if (sections.length === 0) sections.push({ trail: [], blocks: [] });
    sections[sections.length - 1].blocks.push(block);
  }

  const parents: Parent[] = [];
  const children: Child[] = [];

  for (const section of sections) {
    const parent: Parent = {
      id: `p${parents.length + 1}`,
      documentId: document.documentId,
      version: document.version,
      trail: section.trail,
      tokens: sum(section.blocks),
      blockIds: section.blocks.map((block) => block.id),
    };
    parents.push(parent);

    const emit = (bucket: Block[]) => {
      children.push({
        id: `c${children.length + 1}`,
        parentId: parent.id,
        documentId: document.documentId,
        version: document.version,
        trail: section.trail,
        tokens: sum(bucket),
        blockIds: bucket.map((block) => block.id),
      });
    };

    let bucket: Block[] = [];
    for (const block of section.blocks) {
      if (block.kind === 'heading') continue;
      const overflows = bucket.length > 0 && sum(bucket) + block.tokens > config.maxChildTokens;
      // A rule keeps its exception and a list keeps its items, cap or no cap.
      const cannotStart = config.strategy === 'structural' && config.neverStartsAChunk.includes(block.kind);
      if (overflows && !cannotStart) {
        emit(bucket);
        bucket = [];
      }
      bucket.push(block);
    }
    if (bucket.length > 0) emit(bucket);
  }

  return { parents, children };
}
