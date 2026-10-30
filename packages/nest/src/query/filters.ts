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

function utcDayRange(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined
  const range: { gte?: Date; lte?: Date } = {}
  if (from) {
    const d = new Date(String(from))
    d.setUTCHours(0, 0, 0, 0)
    range.gte = d
  }
  if (to) {
    const d = new Date(String(to))
    d.setUTCHours(23, 59, 59, 999)
    range.lte = d
  }
  return range
}

function assertRange(min: unknown, max: unknown, label: string): void {
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
    throw new BadRequestException(
      `${label}: min must be less than or equal to max`,
    )
  }
}

/**
 * Declarative filters (DRF / django-filter style).
 *
 * In defineResource:
 *   filters: {
 *     brandId: Filter.exact(),
 *     sellPrice: Filter.numberRange('minPrice', 'maxPrice'),
 *     createdAt: Filter.dateRange('createdAtFrom', 'createdAtTo'),
 *   }
 *   search: ['name', 'description']  // wired separately as q=
 */
export const Filter = {
  /** `?brandId=3` when key is `brandId` → `{ brandId: 3 }` */
  exact(queryKey?: string): FilterBackend {
    return {
      apply({ query, where, field }) {
        const key = queryKey ?? field
        if (!key) return
        const v = query[key]
        if (v !== undefined && v !== null && v !== "") {
          where[field ?? key] = v
        }
      },
    }
  },

  /** `?minPrice=&maxPrice=` → `{ [field]: { gte, lte } }` */
  numberRange(minKey: string, maxKey: string): FilterBackend {
    return {
      apply({ query, where, field }) {
        if (!field) return
        const min = query[minKey]
        const max = query[maxKey]
        if (min === undefined && max === undefined) return
        assertRange(min, max, field)
        where[field] = {
          ...(min !== undefined && min !== "" && { gte: Number(min) }),
          ...(max !== undefined && max !== "" && { lte: Number(max) }),
        }
      },
    }
  },

  /** `?createdAtFrom=&createdAtTo=` → UTC day bounds */
  dateRange(fromKey: string, toKey: string): FilterBackend {
    return {
      apply({ query, where, field }) {
        if (!field) return
        const range = utcDayRange(
          query[fromKey] as string | undefined,
          query[toKey] as string | undefined,
        )
        if (range) where[field] = range
      },
    }
  },

  /** `?status=a,b` or array → `{ [field]: { in: [...] } }` */
  inList(queryKey?: string): FilterBackend {
    return {
      apply({ query, where, field }) {
        const key = queryKey ?? field
        if (!key || !field) return
        const v = query[key]
        if (v === undefined || v === null || v === "") return
        const list = Array.isArray(v)
          ? v
          : String(v)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
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
 * Case-insensitive `contains` OR across `fields` (dotted paths allowed).
 * Blank / non-string `q` is a no-op.
 */
export function applySearch(
  where: WhereClause,
  fields: readonly string[],
  q: unknown,
): void {
  const search = typeof q === "string" ? q.trim() : ""
  if (!search || fields.length === 0) return
  where.OR = fields.map((field) =>
    nestPath(field, { contains: search, mode: "insensitive" }),
  )
}
