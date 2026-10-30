/**
 * Decimal-safe numeric helpers. Prisma returns `Decimal` objects (decimal.js)
 * for numeric columns; `Number(decimal)` works but is easy to forget, and
 * float maths on money drifts. Hooks should use these helpers.
 */

/** Anything Prisma may hand back for a numeric column. */
export type DecimalLike =
  | number
  | string
  | bigint
  | { toNumber(): number }
  | { toString(): string }

/** Convert a Decimal / string / number to a JS number (null/undefined → 0). */
export function toNumber(value: DecimalLike | null | undefined): number {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber()
  }
  return Number(String(value))
}

/** Money → integer centimes (rounding half away from zero like Math.round). */
export function toCents(value: DecimalLike | null | undefined): number {
  return Math.round(toNumber(value) * 100)
}

/** Integer centimes → money number with 2 decimals. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Sum money values without float drift (adds in centimes). */
export function sumMoney(
  values: Iterable<DecimalLike | null | undefined>,
): number {
  let cents = 0
  for (const v of values) cents += toCents(v)
  return fromCents(cents)
}
