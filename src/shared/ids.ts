let n = 0;
export function createId(prefix: string): string {
  n += 1;
  return `${prefix}_${n}_${Math.random().toString(36).slice(2, 8)}`;
}
