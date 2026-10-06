export function parseQueryInteger(value: unknown): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}
