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

/**
 * Column names and/or constraint/index name involved in a P2002, unquoted.
 * Works with both the classic `meta.target` and the driver-adapter shape.
 * Example (adapter): ['orgId', 'year', 'invoice_sequences_pkey'].
 */
export function prismaUniqueFields(error: unknown): string[] {
  if (!isPrismaUnique(error)) return []
  const meta = error.meta ?? {}
  const out: string[] = []

  const target = meta.target
  if (Array.isArray(target)) out.push(...target.map(unquote))
  else if (typeof target === "string") out.push(unquote(target))

  const cause = meta.driverAdapterError?.cause
  const constraint = cause?.constraint
  if (typeof constraint === "string") {
    out.push(unquote(constraint))
  } else if (constraint) {
    if (Array.isArray(constraint.fields)) {
      out.push(...constraint.fields.map(unquote))
    }
    if (typeof constraint.index === "string") out.push(unquote(constraint.index))
  }

  const message = cause?.originalMessage
  if (typeof message === "string") {
    const match = /constraint "([^"]+)"/.exec(message)
    if (match?.[1]) out.push(match[1])
  }

  return [...new Set(out.filter(Boolean))]
}

/** True when the P2002 involves `field` (column or constraint-name substring). */
export function prismaUniqueIncludes(error: unknown, field: string): boolean {
  return prismaUniqueFields(error).some(
    (f) => f === field || f.includes(field),
  )
}

/**
 * If `error` is Prisma P2002, throw ConflictException with a field-specific
 * message. Otherwise return (caller should rethrow).
 * Keys are matched in declaration order, so put the most specific key first.
 */
export function mapPrismaUnique(
  error: unknown,
  messages: Record<string, string>,
  fallback = "Unique constraint violation",
): void {
  if (!isPrismaUnique(error)) return

  const fields = prismaUniqueFields(error)
  for (const [key, message] of Object.entries(messages)) {
    if (fields.some((field) => field === key || field.includes(key))) {
      throw new ConflictException(message)
    }
  }
  throw new ConflictException(fallback)
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
