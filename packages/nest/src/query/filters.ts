import { BadRequestException } from "@nestjs/common"
import type { WhereClause } from "../core/types.js"

export type { WhereClause }

export type FilterContext = {
  query: Record<string, unknown>
  where: WhereClause
  /** Resource field name when declared in a map key. */
  field?: string
}

export type FilterBackend = {
  apply(ctx: FilterContext): void
}

/**
 * Declared type of a filter value. Query strings arrive as strings when no
 * transforming DTO is used, so typed filters coerce (and validate) them:
 * an invalid value is a 400, never a Prisma 500.
 */
export type FilterValueType = "string" | "number" | "int" | "boolean" | "date"

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === ""
}

function parseDate(value: unknown, label: string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(String(value))
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${label}: invalid date "${String(value)}"`)
  }
  return d
}

/**
 * Coerce one query value to `type`. Throws 400 (BadRequestException) on
 * invalid input. `undefined` type → value returned untouched (0.2.0 behaviour).
 */
export function coerceFilterValue(
  value: unknown,
  type: FilterValueType | undefined,
  label: string,
): unknown {
  if (!type) return value
  if (Array.isArray(value)) {
    throw new BadRequestException(`${label}: expected a single value`)
  }
  switch (type) {
    case "string":
      return String(value)
    case "number":
    case "int": {
      const n =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value.trim())
            : Number.NaN
      if (!Number.isFinite(n) || (type === "int" && !Number.isSafeInteger(n))) {
        throw new BadRequestException(
          `${label}: expected ${type === "int" ? "an integer" : "a number"}, got "${String(value)}"`,
        )
      }
      return n
    }
    case "boolean": {
      if (typeof value === "boolean") return value
      const v = String(value).trim().toLowerCase()
      if (v === "true" || v === "1") return true
      if (v === "false" || v === "0") return false
      throw new BadRequestException(
        `${label}: expected a boolean (true/false), got "${String(value)}"`,
      )
    }
    case "date":
      return parseDate(value, label)
    default:
      return value
  }
}

function utcDayRange(
  from: unknown,
  to: unknown,
  label: string,
): { gte?: Date; lte?: Date } | undefined {
  if (isBlank(from) && isBlank(to)) return undefined
  const range: { gte?: Date; lte?: Date } = {}
  if (!isBlank(from)) {
    const d = parseDate(from, label)
    d.setUTCHours(0, 0, 0, 0)
    range.gte = d
  }
  if (!isBlank(to)) {
    const d = parseDate(to, label)
    d.setUTCHours(23, 59, 59, 999)
    range.lte = d
  }
  return range
}

export type ExactFilterOptions = {
  /** Query key (default: the filter's field name). */
  key?: string
  /** Coerce + validate the value (default: passed through untouched). */
  type?: FilterValueType
}

export type RangeFilterOptions = {
  /** `int` rejects decimals (default `number`). */
  type?: "number" | "int"
}

export type InListFilterOptions = {
  key?: string
  /** Coerce + validate every list item. */
  type?: FilterValueType
}

function exactOptions(
  keyOrOptions?: string | ExactFilterOptions,
  type?: FilterValueType,
): ExactFilterOptions {
  if (typeof keyOrOptions === "object") return keyOrOptions
  return { key: keyOrOptions, type }
}

/**
 * Declarative filters (DRF / django-filter style).
 *
 * In defineResource:
 *   filters: {
 *     brandId: Filter.exact({ type: 'int' }),      // '?brandId=3' → 3, 'abc' → 400
 *     isActive: Filter.exact({ type: 'boolean' }), // 'true' / 'false' / 1 / 0
 *     sellPrice: Filter.numberRange('minPrice', 'maxPrice'),
 *     createdAt: Filter.dateRange('createdAtFrom', 'createdAtTo'),
 *   }
 *   search: ['name', 'description']  // wired separately as q=
 *
 * Invalid input (bad number / date / boolean, min > max) → 400.
 */
export const Filter = {
  /**
   * `?brandId=3` when key is `brandId` → `{ brandId: 3 }`.
   * Accepts `exact()`, `exact('queryKey')`, `exact('queryKey', 'int')` or
   * `exact({ key?, type? })`. Without `type` the raw value is used (rely on a
   * transforming DTO); with `type` it is coerced and validated (400).
   */
  exact(
    keyOrOptions?: string | ExactFilterOptions,
    type?: FilterValueType,
  ): FilterBackend {
    const opts = exactOptions(keyOrOptions, type)
    return {
      apply({ query, where, field }) {
        const key = opts.key ?? field
        if (!key) return
        const v = query[key]
        if (isBlank(v)) return
        where[field ?? key] = coerceFilterValue(v, opts.type, key)
      },
    }
  },

  /**
   * `?minPrice=&maxPrice=` → `{ [field]: { gte, lte } }`. Values are always
   * coerced to numbers; a non-numeric value or min > max → 400.
   */
  numberRange(
    minKey: string,
    maxKey: string,
    options: RangeFilterOptions = {},
  ): FilterBackend {
    const type = options.type ?? "number"
    return {
      apply({ query, where, field }) {
        if (!field) return
        const rawMin = query[minKey]
        const rawMax = query[maxKey]
        if (isBlank(rawMin) && isBlank(rawMax)) return
        const min = isBlank(rawMin)
          ? undefined
          : (coerceFilterValue(rawMin, type, minKey) as number)
        const max = isBlank(rawMax)
          ? undefined
          : (coerceFilterValue(rawMax, type, maxKey) as number)
        if (min !== undefined && max !== undefined && min > max) {
          throw new BadRequestException(
            `${field}: min must be less than or equal to max`,
          )
        }
        where[field] = {
          ...(min !== undefined && { gte: min }),
          ...(max !== undefined && { lte: max }),
        }
      },
    }
  },

  /** `?createdAtFrom=&createdAtTo=` → UTC day bounds. Invalid date → 400. */
  dateRange(fromKey: string, toKey: string): FilterBackend {
    return {
      apply({ query, where, field }) {
        if (!field) return
        const range = utcDayRange(query[fromKey], query[toKey], field)
        if (range) where[field] = range
      },
    }
  },

  /**
   * `?status=a,b` or array → `{ [field]: { in: [...] } }`.
   * Accepts `inList()`, `inList('queryKey')`, `inList('queryKey', 'int')` or
   * `inList({ key?, type? })`; with `type` every item is coerced (400).
   */
  inList(
    keyOrOptions?: string | InListFilterOptions,
    type?: FilterValueType,
  ): FilterBackend {
    const opts = exactOptions(keyOrOptions, type)
    return {
      apply({ query, where, field }) {
        const key = opts.key ?? field
        if (!key || !field) return
        const v = query[key]
        if (isBlank(v)) return
        const list = (
          Array.isArray(v)
            ? v
            : String(v)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
        ).map((item) => coerceFilterValue(item, opts.type, key))
        if (list.length) where[field] = { in: list }
      },
    }
  },

  custom(fn: (ctx: FilterContext) => void): FilterBackend {
    return { apply: fn }
  },
}

/**
 * `{ path: "a.b.c" }` → `{ a: { b: { c: leaf } } }` (relation search, e.g.
 * `deliveryNote.deliveryNoteNumber`). A plain field stays flat.
 */
function nestPath(path: string, leaf: unknown): WhereClause {
  return path
    .split(".")
    .reduceRight<unknown>((acc, key) => ({ [key]: acc }), leaf) as WhereClause
}

/**
 * `contains` OR across `fields` (dotted paths allowed). Blank / non-string
 * `q` is a no-op.
 *
 * `insensitive` (default true) adds Prisma's `mode: "insensitive"`, which is
 * only supported on PostgreSQL / MongoDB. Pass `false` for MySQL / SQLite /
 * SQL Server (case sensitivity then follows the column collation).
 */
export function applySearch(
  where: WhereClause,
  fields: readonly string[],
  q: unknown,
  insensitive = true,
): void {
  const search = typeof q === "string" ? q.trim() : ""
  if (!search || fields.length === 0) return
  where.OR = fields.map((field) =>
    nestPath(
      field,
      insensitive
        ? { contains: search, mode: "insensitive" }
        : { contains: search },
    ),
  )
}
