/** Accept compact 24-hour times while preserving incomplete or invalid input. */
export function normalizeTimeInput(value: string): string {
  if (/^(?:[01]\d|2[0-3])[0-5]\d$/.test(value)) {
    return `${value.slice(0, 2)}:${value.slice(2)}`;
  }
  return value;
}
