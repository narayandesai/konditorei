export function parsePositiveInt(s: string): number | null {
  // /^\d+$/ rejects whitespace, signs, decimals, and scientific notation
  // before Number() can silently coerce them to valid-looking integers.
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= 1 ? n : null
}
