import { ConflictException } from "@nestjs/common"

/**
 * Duck-typed Prisma P2002 (no generated client import in the kit).
 *
 * Two shapes exist in the wild:
 * - classic engine (Prisma <= 6 without driver adapters):
 *     meta.target = ["orgId", "code"]  or  "orders_orgId_quoteId_key"
 * - Prisma 7 / driver adapters (@prisma/adapter-pg), observed live:
 *     meta.modelName = "InvoiceSequence"
 *     meta.driverAdapterError.cause = {
 *       originalCode: "23505",
 *       originalMessage: 'duplicate key value violates unique constraint "invoice_sequences_pkey"',
 *       kind: "UniqueConstraintViolation",
 *       constraint: { fields: ['"orgId"', "year"] }   // or { index: "..." }
 *     }
 */
export type PrismaUniqueLike = {
  code: string
  meta?: {
    target?: string | string[]
    modelName?: string
    driverAdapterError?: {
      cause?: {
        originalCode?: string
        originalMessage?: string
        kind?: string
        constraint?: { fields?: string[]; index?: string } | string
      }
    }
  }
}

export function isPrismaUnique(error: unknown): error is PrismaUniqueLike {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PrismaUniqueLike).code === "P2002"
  )
}

function unquote(value: unknown): string {
  return String(value).trim().replace(/^"+|"+$/g, "")
}

/** Column names reported by a P2002 (classic `meta.target` array or adapter `constraint.fields`), unquoted. */
export function prismaUniqueColumns(error: unknown): string[] {
  if (!isPrismaUnique(error)) return []
  const meta = error.meta ?? {}
  const out: string[] = []
  if (Array.isArray(meta.target)) out.push(...meta.target.map(unquote))
  const constraint = meta.driverAdapterError?.cause?.constraint
  if (constraint && typeof constraint === "object" && Array.isArray(constraint.fields)) {
    out.push(...constraint.fields.map(unquote))
  }
  return [...new Set(out.filter(Boolean))]
}

/** Constraint / index names reported by a P2002 (e.g. `orders_orgId_quoteId_key`). */
export function prismaUniqueConstraints(error: unknown): string[] {
  if (!isPrismaUnique(error)) return []
  const meta = error.meta ?? {}
  const out: string[] = []
  if (typeof meta.target === "string") out.push(unquote(meta.target))
  const cause = meta.driverAdapterError?.cause
  const constraint = cause?.constraint
  if (typeof constraint === "string") out.push(unquote(constraint))
  else if (constraint && typeof constraint.index === "string") {
    out.push(unquote(constraint.index))
  }
  const message = cause?.originalMessage
  if (typeof message === "string") {
    const match = /constraint "([^"]+)"/.exec(message)
    if (match?.[1]) out.push(match[1])
  }
  return [...new Set(out.filter(Boolean))]
}

/**
 * Column names and/or constraint/index name involved in a P2002, unquoted.
 * Works with both the classic `meta.target` and the driver-adapter shape.
 * Example (adapter): ['orgId', 'year', 'invoice_sequences_pkey'].
 */
export function prismaUniqueFields(error: unknown): string[] {
  return [
    ...new Set([...prismaUniqueColumns(error), ...prismaUniqueConstraints(error)]),
  ]
}

/**
 * Columns to match against: the reported columns, or — when the error only
 * names a constraint (partial unique index on adapters) — the `_`-separated
 * tokens of that name (`orders_orgId_quoteId_key` → orders, orgId, quoteId, key).
 * Tokens are compared whole, never as substrings.
 */
function matchableColumns(error: unknown): Set<string> {
  const columns = prismaUniqueColumns(error)
  if (columns.length) return new Set(columns)
  return new Set(prismaUniqueConstraints(error).flatMap((c) => c.split("_")))
}

function keyColumns(key: string): string[] {
  return key
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
}

/**
 * Exact match of a `unique.messages` key against a P2002:
 * - the exact constraint / index name (`orders_orgId_quoteId_key`), or
 * - a column (`quoteId`), or a comma-separated set of columns that must all
 *   be part of the conflict (`orgId,code`).
 * No substring matching: `name` does not match `displayName`.
 */
export function prismaUniqueMatches(error: unknown, key: string): boolean {
  if (!isPrismaUnique(error)) return false
  const k = key.trim()
  if (!k) return false
  if (prismaUniqueConstraints(error).includes(k)) return true
  const wanted = keyColumns(k)
  if (!wanted.length) return false
  const columns = matchableColumns(error)
  return wanted.every((c) => columns.has(c))
}

/** True when the P2002 involves `field` (exact column, column set or constraint name; see `prismaUniqueMatches`). */
export function prismaUniqueIncludes(error: unknown, field: string): boolean {
  return prismaUniqueMatches(error, field)
}

/** Body of the 409 thrown by `mapPrismaUnique`. */
export type UniqueConflictBody = {
  statusCode: 409
  /** Unchanged from 0.2.0 (configured message or fallback). */
  message: string
  error: "Conflict"
  /**
   * Conflicting columns, without the tenant column `orgId` (always part of
   * org-scoped unique keys and not something a client can change). When the
   * error only names an index, the columns of the matched key (or `[]`).
   */
  fields: string[]
}

function conflict(message: string, fields: string[]): ConflictException {
  const body: UniqueConflictBody = {
    statusCode: 409,
    message,
    error: "Conflict",
    fields: fields.filter((f) => f !== "orgId"),
  }
  return new ConflictException(body)
}

/**
 * If `error` is Prisma P2002, throw ConflictException (409) with a
 * field-specific message and `fields: string[]` in the body. Otherwise return
 * (caller should rethrow).
 * Keys are matched exactly (see `prismaUniqueMatches`) in declaration order,
 * so put the most specific key first.
 */
export function mapPrismaUnique(
  error: unknown,
  messages: Record<string, string>,
  fallback = "Unique constraint violation",
): void {
  if (!isPrismaUnique(error)) return

  const columns = prismaUniqueColumns(error)
  for (const [key, message] of Object.entries(messages)) {
    if (prismaUniqueMatches(error, key)) {
      const isConstraintKey = prismaUniqueConstraints(error).includes(key.trim())
      throw conflict(
        message,
        columns.length ? columns : isConstraintKey ? [] : keyColumns(key),
      )
    }
  }
  throw conflict(fallback, columns)
}

/** Build a classic P2002-shaped error (tests / in-memory stores). */
export function prismaUniqueError(fields: string[]): PrismaUniqueLike & Error {
  const err = new Error(
    `Unique constraint failed on the fields: (${fields.join(", ")})`,
  ) as Error & PrismaUniqueLike
  err.code = "P2002"
  err.meta = { target: fields }
  return err
}

/** Build a Prisma-7 driver-adapter P2002 (tests). */
export function prismaAdapterUniqueError(
  fields: string[],
  constraintName: string,
  modelName = "Model",
): PrismaUniqueLike & Error {
  const err = new Error(
    "Unique constraint failed on the constraint: `" + constraintName + "`",
  ) as Error & PrismaUniqueLike
  err.code = "P2002"
  err.meta = {
    modelName,
    driverAdapterError: {
      cause: {
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "${constraintName}"`,
        kind: "UniqueConstraintViolation",
        constraint: { fields: fields.map((f) => `"${f}"`) },
      },
    },
  }
  return err
}
