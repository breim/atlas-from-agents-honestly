/** Code points, so an emoji or an ellipsis counts as one character in both tracks. */
const chars = (text: string): string[] => [...text];

export function truncate(text: string, budget: number, marker: string): string {
  const source = chars(text);
  if (source.length <= budget) return text;

  const room = budget - chars(marker).length;
  if (room <= 0) return chars(marker).slice(0, budget).join('');

  const head = Math.ceil(room / 2);
  const tail = room - head;
  return source.slice(0, head).join('') + marker + (tail > 0 ? source.slice(-tail).join('') : '');
}
