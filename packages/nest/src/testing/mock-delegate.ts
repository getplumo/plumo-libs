import type { ModelDelegate, OrgRow } from "../core/types.js"

/** Prisma P2025-shaped error (record to update/delete not found). */
export function recordNotFound(): Error & { code: string } {
  const err = new Error("Record to update not found.") as Error & {
    code: string
  }
  err.code = "P2025"
  return err
}

/** In-memory ModelDelegate for unit tests (exported from `@plumo/nest/internal`). */
export function createMockDelegate(): ModelDelegate & {
  rows: OrgRow[]
} {
  const rows: OrgRow[] = []
  let seq = 1

  function match(row: OrgRow, where: Record<string, unknown>): boolean {
    for (const [key, condition] of Object.entries(where)) {
      if (key === "AND" && Array.isArray(condition)) {
        if (
          !condition.every((c) => match(row, c as Record<string, unknown>))
        ) {
          return false
        }
        continue
      }
      if (key === "OR" && Array.isArray(condition)) {
        if (
          !condition.some((c) => match(row, c as Record<string, unknown>))
        ) {
          return false
        }
        continue
      }
      if (condition === null) {
        if (row[key] != null) return false
        continue
      }
      if (
        condition &&
        typeof condition === "object" &&
        !Array.isArray(condition) &&
        !(condition instanceof Date)
      ) {
        const c = condition as Record<string, unknown>
        if ("in" in c && Array.isArray(c.in)) {
          if (!c.in.includes(row[key])) return false
          continue
        }
        if ("contains" in c) {
          if (
            !String(row[key] ?? "")
              .toLowerCase()
              .includes(String(c.contains).toLowerCase())
          ) {
            return false
          }
          continue
        }
        if ("gte" in c || "lte" in c) {
          const num = Number(row[key])
          if (c.gte !== undefined && !(num >= Number(c.gte))) return false
          if (c.lte !== undefined && !(num <= Number(c.lte))) return false
          continue
        }
      }
      if (row[key] !== condition) return false
    }
    return true
  }

  const delegate: ModelDelegate & { rows: OrgRow[] } = {
    rows,
    async findFirst({ where }) {
      return rows.find((r) => match(r, where)) ?? null
    },
    async findMany({ where, skip = 0, take }) {
      let list = rows.filter((r) => match(r, where ?? {}))
      list = list.slice(skip, take !== undefined ? skip + take : undefined)
      return list
    },
    async count({ where }) {
      return rows.filter((r) => match(r, where ?? {})).length
    },
    async create({ data }) {
      const row = {
        id: seq++,
        createdAt: new Date(),
        ...data,
      } as OrgRow
      rows.push(row)
      return row
    },
    async update({ where, data }) {
      const row = rows.find((r) => match(r, where))
      if (!row) throw recordNotFound()
      Object.assign(row, data)
      return row
    },
    async delete({ where }) {
      const idx = rows.findIndex((r) => match(r, where))
      if (idx < 0) throw recordNotFound()
      const [row] = rows.splice(idx, 1)
      return row!
    },
  }
  return delegate
}
