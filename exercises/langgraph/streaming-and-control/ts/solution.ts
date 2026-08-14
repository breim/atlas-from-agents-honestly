export interface Chunk {
  type: 'text' | 'tool_start' | 'tool_arg' | 'tool_end' | 'done';
  value?: string;
}

export interface ToolCall {
  name: string;
  args: string;
}

export interface Assembled {
  text: string;
  toolCalls: ToolCall[];
  complete: boolean;
}

export function assemble(chunks: Chunk[]): Assembled {
  let text = '';
  let complete = false;
  let open: ToolCall | null = null;
  const toolCalls: ToolCall[] = [];

  for (const chunk of chunks) {
    if (chunk.type === 'text') text += chunk.value ?? '';
    else if (chunk.type === 'tool_start') open = { name: chunk.value ?? '', args: '' };
    else if (chunk.type === 'tool_arg' && open) open.args += chunk.value ?? '';
    else if (chunk.type === 'tool_end' && open) {
      // Only a closed call is real; an open one at the end is dropped.
      toolCalls.push(open);
      open = null;
    } else if (chunk.type === 'done') complete = true;
  }

  return { text, toolCalls, complete };
}
