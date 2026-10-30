/** Loose row shape — Prisma models are richer at the call site. */
export type OrgRow = Record<string, unknown> & {
  id: number
  orgId?: string
}

/** Prisma-style `where` object. */
export type WhereClause = Record<string, unknown>

export type SortDirection = "asc" | "desc"

/** Single field or Prisma-style multi-field orderBy. */
export type OrderBy =
  | Record<string, SortDirection>
  | Array<Record<string, SortDirection>>

/** String keys of a row/DTO type (used to type field names in resources). */
export type FieldOf<T> = Extract<keyof T, string>

/**
 * Minimal Prisma-like model delegate used by the services / requireInOrg.
 * Real `PrismaService.product` etc. satisfy this structurally.
 *
 * `update` / `delete` take an extended unique where (`{ id, orgId }`, Prisma 5+)
 * so the tenant is enforced again at write time (defence in depth).
 */
export type ModelDelegate = {
  findFirst(args: {
    where: WhereClause
    include?: unknown
    select?: unknown
  }): Promise<OrgRow | null>
  findMany(args: {
    where?: WhereClause
    orderBy?: unknown
    skip?: number
    take?: number
    include?: unknown
    select?: unknown
  }): Promise<OrgRow[]>
  count(args: { where?: WhereClause }): Promise<number>
  create(args: {
    data: Record<string, unknown>
    include?: unknown
  }): Promise<OrgRow>
  update(args: {
    where: { id: number; orgId?: string }
    data: Record<string, unknown>
    include?: unknown
  }): Promise<OrgRow>
  delete(args: {
    where: { id: number; orgId?: string }
    include?: unknown
  }): Promise<OrgRow>
}

/**
 * Host that exposes named delegates (PrismaService or a transaction client).
 * Typed as `object` so concrete Prisma clients assign without an index signature.
 */
export type DelegateHost = object

/** Host that can open an interactive transaction (PrismaService). */
export type TransactionHost = {
  $transaction<R>(fn: (tx: never) => Promise<R>): Promise<R>
}

/** Resolve `host[model]` as a ModelDelegate (throws on unknown model). */
export function delegateOf(host: DelegateHost, model: string): ModelDelegate {
  const d = (host as Record<string, unknown>)[model]
  if (!d || typeof d !== "object") {
    throw new Error(`No delegate for model "${model}"`)
  }
  return d as ModelDelegate
}

/** Who performs a write (Clerk user + org role) — from the verified token. */
export type Actor = {
  userId: string
  orgRole?: string | null
}
