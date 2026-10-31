import type { Actor, DelegateHost, WhereClause } from "../core/types.js"
import type { ApprovalStatusPatch, ApprovalStatusValue } from "../approval/approval.js"
import type { ListQuery } from "../query/pipeline.js"

/**
 * Type parameters of a resource service, as one object so call sites stay
 * readable: `OrgResourceService<{ row: Product; create: CreateProductDto }>`.
 *
 * - `row`      DB row as loaded with the resource `include` (required).
 * - `create`   create DTO (default: plain record).
 * - `update`   update DTO (default: `Partial<create>`).
 * - `output`   what retrieve/create/update return after `presentOne` (default `row`).
 * - `listItem` list element after `presentList` (default `row`).
 * - `tx`       client type handed to hooks as `ctx.tx` (e.g.
 *              `Prisma.TransactionClient`; default: a loose delegate host).
 */
export type ResourceTypes = {
  row: object
  create?: object
  update?: object
  output?: unknown
  listItem?: unknown
  tx?: unknown
}

export type RowOf<T extends ResourceTypes> = T["row"]
export type CreateOf<T extends ResourceTypes> = T extends { create: infer C }
  ? C
  : Record<string, unknown>
export type UpdateOf<T extends ResourceTypes> = T extends { update: infer U }
  ? U
  : Partial<CreateOf<T>>
export type OutputOf<T extends ResourceTypes> = T extends { output: infer O }
  ? O
  : RowOf<T>
export type ListItemOf<T extends ResourceTypes> = T extends {
  listItem: infer L
}
  ? L
  : RowOf<T>
export type TxOf<T extends ResourceTypes> = T extends { tx: infer X }
  ? X
  : DelegateHost

/** Data handed to Prisma `create` / `update` (orgId/id are stripped/forced). */
export type WriteData = Record<string, unknown>

export type WriteAction = "create" | "update" | "destroy" | "approval"

/** Shared by every write hook. */
export type WriteContext<TRow, TTx = DelegateHost> = {
  orgId: string
  /** From the verified token; absent for system writes. */
  actor?: Actor
  /**
   * Prisma client to use inside hooks: the interactive transaction client
   * when the resource is `transactional`, otherwise the service's client.
   */
  tx: TTx
  /**
   * Register work to run right after the row is written, **inside** the same
   * transaction (e.g. stock moves, cache tables). Runs before `after*` hooks.
   * A throw here rolls the whole write back (when `transactional`) and is
   * returned to the client. Not for side effects that must only happen once
   * the data is durable — use `afterCommit` for those.
   */
  afterWrite(fn: (row: TRow) => void | Promise<void>): void
  /**
   * Register work to run only once the write is durable (audit logs,
   * notifications, webhooks, outbox kicks):
   * - `transactional: true` → after `$transaction` resolves (committed);
   *   never runs if the transaction rolls back.
   * - otherwise → after the write and its hooks; if a later hook throws, the
   *   row is already persisted, so callbacks registered up to that point
   *   still run (the client still gets the hook's error).
   *
   * Callbacks run in registration order, after the list cache is
   * invalidated and before the response is returned (awaited). They get the
   * written row (as returned by Prisma, before `presentOne`). Errors are
   * logged (Nest `Logger`, context = service class) and swallowed — they
   * never fail the request. Use `this.db`, not `ctx.tx` (the tx is closed).
   */
  afterCommit(fn: AfterCommitFn<TRow>): void
}

/** Callback registered with `ctx.afterCommit`. */
export type AfterCommitFn<TRow> = (row: TRow) => void | Promise<void>

export type CreateContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & { action: "create" }

export type UpdateContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
  action: "update"
  id: number
  /** Row before the write (loaded with the resource include). */
  existing: TRow
}

export type DestroyContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
  action: "destroy"
  id: number
  existing: TRow
}

export type ApprovalChange = {
  from: ApprovalStatusValue
  to: ApprovalStatusValue
  patch: ApprovalStatusPatch
}

export type ApprovalContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
  action: "approval"
  id: number
  existing: TRow
  change: ApprovalChange
}

export type PresentAction = "retrieve" | "create" | "update" | "approval"

export type PresentContext = {
  orgId: string
  action: PresentAction
}

export type ListContext = {
  orgId: string
  query: ListQuery
}

/** Paginated list envelope (identical to 0.1). */
export type { PaginatedResult } from "../query/pagination.js"

export type ScopeFn = (orgId: string, query: ListQuery) => WhereClause
