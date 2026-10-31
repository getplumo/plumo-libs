import { Logger, NotFoundException } from "@nestjs/common"
import {
  delegateOf,
  type Actor,
  type DelegateHost,
  type ModelDelegate,
  type OrgRow,
  type TransactionHost,
  type WhereClause,
} from "../core/types.js"
import {
  assertApprovalStatus,
  buildApprovalStatusPatch,
  type ApprovalStatusValue,
} from "../approval/approval.js"
import {
  defaultOrgListCache,
  type OrgListCache,
} from "../cache/org-list-cache.js"
import { mapPrismaUnique } from "../prisma/unique.js"
import { paginatedResult, type PaginatedResult } from "../query/pagination.js"
import {
  planList,
  QueryStrategies,
  strategiesFor,
  type ListQuery,
  type QueryStrategy,
} from "../query/pipeline.js"
import {
  includeFor,
  type DefinedResource,
  type IncludeOn,
} from "../resource/resource.js"
import { requireInOrg } from "../tenancy/require-in-org.js"
import type {
  AfterCommitFn,
  ApprovalContext,
  CreateContext,
  CreateOf,
  DestroyContext,
  ListContext,
  ListItemOf,
  OutputOf,
  PresentContext,
  ResourceTypes,
  RowOf,
  TxOf,
  UpdateContext,
  UpdateOf,
  WriteAction,
  WriteContext,
  WriteData,
} from "./context.js"

/** `list()` result: `{ data, pagination }`, or a plain array for `listMode: 'all'`. */
export type ResourceList<TItem> = PaginatedResult<TItem> | TItem[]

type Hook<T> = T | Promise<T>

/** Body of `PATCH :id/approval`. */
export type ApprovalInput = { approvalStatus: ApprovalStatusValue | string }

/**
 * Typed, org-scoped CRUD service driven by a `defineResource()` definition.
 *
 * Subclass to customise with **lifecycle hooks** instead of overriding whole
 * methods:
 *
 * | step           | hook                                   |
 * |----------------|----------------------------------------|
 * | list where     | `scope(orgId, query)` / `queryStrategies()` |
 * | list rows      | `presentList(rows, ctx)`               |
 * | create         | `beforeCreate(dto, ctx)` → data, `afterCreate(row, ctx)` |
 * | update         | `beforeUpdate(dto, ctx)` → data, `afterUpdate(row, ctx)` |
 * | destroy        | `beforeDestroy(ctx)`, `afterDestroy(row, ctx)` |
 * | approval       | `beforeApproval(ctx)`, `afterApproval(row, ctx)` |
 * | detail shape   | `presentOne(row, ctx)`                 |
 *
 * Guarantees:
 * - tenancy comes only from the `orgId` argument (the token) and is applied
 *   last on reads and again on writes (`where: { id, orgId }`);
 * - `orgId` / `id` in a write payload are stripped (no tenant hopping);
 * - unknown / other-org ids → 404 `notFoundMessage` before any write;
 * - with `transactional: true` the hooks and the write share `ctx.tx`;
 * - P2002 → 409 via `resource.unique`; list cache invalidated after writes;
 * - `ctx.afterWrite(fn)` runs inside the write/transaction (a throw rolls
 *   back); `ctx.afterCommit(fn)` runs only once the write is durable, and its
 *   errors are logged, not returned to the client.
 */
export class OrgResourceService<T extends ResourceTypes = { row: OrgRow }> {
  constructor(
    protected readonly db: DelegateHost,
    protected readonly resource: DefinedResource<never> | DefinedResource,
    protected readonly listCache: OrgListCache = defaultOrgListCache,
  ) {
    const cfg = this.def.listCache
    if (cfg?.dependsOn?.length) {
      listCache.registerDependencies(cfg.scope, cfg.dependsOn)
    }
  }

  /** Resource definition with field names widened to string. */
  protected get def(): DefinedResource {
    return this.resource as DefinedResource
  }

  /** Model delegate on the service client (or on `host`, e.g. a tx). */
  protected delegate(host: DelegateHost = this.db): ModelDelegate {
    return delegateOf(host, this.def.model)
  }

  // ---------------------------------------------------------------- reads

  async list(
    orgId: string,
    query: ListQuery = {},
  ): Promise<ResourceList<ListItemOf<T>>> {
    const load = () =>
      this.def.listMode === "all"
        ? this.loadAll(orgId, query)
        : this.loadPage(orgId, query)
    const cfg = this.def.listCache
    if (!cfg) return load()
    const variant =
      this.def.listMode === "all" && Object.keys(query).length === 0
        ? ""
        : query
    return this.listCache.getOrSet<ResourceList<ListItemOf<T>>>(
      cfg.scope,
      orgId,
      variant,
      load,
      { ttlMs: cfg.ttlMs },
    )
  }

  async retrieve(orgId: string, id: number): Promise<OutputOf<T>> {
    const row = await this.findOrFail(orgId, id, "retrieve")
    return this.presentOne(row, { orgId, action: "retrieve" })
  }

  /**
   * Load `{ id, orgId }` (with the include configured for `action`) or throw
   * 404. Writes call this before opening the transaction.
   */
  protected async findOrFail(
    orgId: string,
    id: number,
    action: keyof IncludeOn = "retrieve",
    host: DelegateHost = this.db,
  ): Promise<RowOf<T>> {
    const where: WhereClause = { id, orgId }
    if (this.def.softDelete) where[this.def.softDelete.field] = null
    const row = await this.delegate(host).findFirst({
      where,
      ...includeFor(this.def, action),
    })
    if (!row) throw new NotFoundException(this.def.notFoundMessage)
    return row as RowOf<T>
  }

  /** Strategies for the list where. Tenancy is always applied after them. */
  protected queryStrategies(): QueryStrategy[] {
    return [
      ...strategiesFor(this.def),
      QueryStrategies.where(({ orgId, query }) => this.scope(orgId, query)),
    ]
  }

  /** Prisma select/include for list rows. */
  protected listShape(): { select?: unknown; include?: unknown } {
    const r = this.def
    if (r.listSelect) return { select: r.listSelect }
    const include = r.listInclude ?? r.include
    return include ? { include } : {}
  }

  protected async loadAll(
    orgId: string,
    query: ListQuery,
  ): Promise<ListItemOf<T>[]> {
    const { where, orderBy } = planList(
      this.def,
      orgId,
      query,
      this.queryStrategies(),
    )
    const rows = await this.delegate().findMany({
      where,
      orderBy,
      ...this.listShape(),
    })
    return this.presentList(rows as RowOf<T>[], { orgId, query })
  }

  protected async loadPage(
    orgId: string,
    query: ListQuery,
  ): Promise<PaginatedResult<ListItemOf<T>>> {
    const { where, orderBy, page, limit, skip } = planList(
      this.def,
      orgId,
      query,
      this.queryStrategies(),
    )
    const [rows, total] = await Promise.all([
      this.delegate().findMany({
        where,
        orderBy,
        ...this.listShape(),
        skip,
        take: limit,
      }),
      this.delegate().count({ where }),
    ])
    const data = await this.presentList(rows as RowOf<T>[], { orgId, query })
    return paginatedResult(data, total, page, limit)
  }

  // --------------------------------------------------------------- writes

  async create(
    orgId: string,
    dto: CreateOf<T>,
    actor?: Actor,
  ): Promise<OutputOf<T>> {
    const row = await this.runWrite<CreateContext<RowOf<T>, TxOf<T>>>(
      "create",
      orgId,
      actor,
      {},
      async (ctx) => {
        await this.checkRelations("create", orgId, dto, hostOf(ctx))
        const data = stripKeys(await this.beforeCreate(dto, ctx))
        return this.delegate(hostOf(ctx)).create({
          data: { ...data, orgId },
          ...includeFor(this.def, "create"),
        }) as Promise<RowOf<T>>
      },
      (row, ctx) => this.afterCreate(row, ctx),
    )
    return this.presentOne(row, { orgId, action: "create" })
  }

  async update(
    orgId: string,
    id: number,
    dto: UpdateOf<T>,
    actor?: Actor,
  ): Promise<OutputOf<T>> {
    const existing = await this.findOrFail(orgId, id, "update")
    const row = await this.runWrite<UpdateContext<RowOf<T>, TxOf<T>>>(
      "update",
      orgId,
      actor,
      { id, existing },
      async (ctx) => {
        await this.checkRelations("update", orgId, dto, hostOf(ctx))
        const data = stripKeys(await this.beforeUpdate(dto, ctx))
        return this.delegate(hostOf(ctx)).update({
          where: { id, orgId },
          data,
          ...includeFor(this.def, "update"),
        }) as Promise<RowOf<T>>
      },
      (row, ctx) => this.afterUpdate(row, ctx),
    )
    return this.presentOne(row, { orgId, action: "update" })
  }

  /** Returns the deleted row (not presented), like 0.1. */
  async destroy(orgId: string, id: number, actor?: Actor): Promise<RowOf<T>> {
    const existing = await this.findOrFail(orgId, id, "destroy")
    return this.runWrite<DestroyContext<RowOf<T>, TxOf<T>>>(
      "destroy",
      orgId,
      actor,
      { id, existing },
      async (ctx) => {
        await this.beforeDestroy(ctx)
        const soft = this.def.softDelete
        const delegate = this.delegate(hostOf(ctx))
        const include = includeFor(this.def, "destroy")
        return (
          soft
            ? delegate.update({
                where: { id, orgId },
                data: { [soft.field]: new Date() },
                ...include,
              })
            : delegate.delete({ where: { id, orgId }, ...include })
        ) as Promise<RowOf<T>>
      },
      (row, ctx) => this.afterDestroy(row, ctx),
    )
  }

  /**
   * Approval workflow (`PATCH :id/approval`). Status other than
   * pending/approved/rejected → 400. Unchanged status → returns the
   * current row (no write). Otherwise checks the actor role (403), runs
   * `beforeApproval`, writes the patch and `afterApproval`.
   */
  async updateApproval(
    orgId: string,
    id: number,
    dto: ApprovalInput,
    actor: Actor,
  ): Promise<OutputOf<T>> {
    // 400 for anything but pending/approved/rejected, even without a DTO.
    const to: unknown = (dto as Partial<ApprovalInput> | null | undefined)
      ?.approvalStatus
    assertApprovalStatus(to)
    const existing = await this.findOrFail(orgId, id, "approval")
    const from = String(
      (existing as { approvalStatus?: unknown }).approvalStatus,
    ) as ApprovalStatusValue
    const patch = buildApprovalStatusPatch(from, to, actor)
    if (!patch) return this.presentOne(existing, { orgId, action: "approval" })
    const row = await this.runWrite<ApprovalContext<RowOf<T>, TxOf<T>>>(
      "approval",
      orgId,
      actor,
      { id, existing, change: { from, to, patch } },
      async (ctx) => {
        await this.beforeApproval(ctx)
        return this.delegate(hostOf(ctx)).update({
          where: { id, orgId },
          data: patch,
          ...includeFor(this.def, "approval"),
        }) as Promise<RowOf<T>>
      },
      (row, ctx) => this.afterApproval(row, ctx),
    )
    return this.presentOne(row, { orgId, action: "approval" })
  }

  /**
   * Shared write runner: builds the context, opens the transaction when the
   * resource is transactional, runs `afterWrite` callbacks + the after hook,
   * maps unique errors, invalidates the list cache once the write is durable
   * and then runs `afterCommit` callbacks (errors logged, never thrown).
   *
   * Non-transactional: if a hook throws after the row was written, the row
   * stays persisted, so the list cache (+ dependants) is still invalidated
   * and the registered `afterCommit` callbacks still run before rethrowing.
   */
  protected async runWrite<C extends WriteContext<RowOf<T>, TxOf<T>>>(
    action: WriteAction,
    orgId: string,
    actor: Actor | undefined,
    extra: Omit<C, keyof WriteContext<RowOf<T>, TxOf<T>> | "action">,
    write: (ctx: C) => Promise<RowOf<T>>,
    after: (row: RowOf<T>, ctx: C) => Hook<void>,
  ): Promise<RowOf<T>> {
    let committed: AfterCommitFn<RowOf<T>>[] = []
    let written: { row: RowOf<T> } | undefined
    const exec = async (tx: DelegateHost): Promise<RowOf<T>> => {
      const callbacks: Array<(row: RowOf<T>) => Hook<void>> = []
      const onCommit: AfterCommitFn<RowOf<T>>[] = []
      // A retried transaction callback starts from a clean list.
      committed = onCommit
      const ctx = {
        ...extra,
        action,
        orgId,
        actor,
        tx,
        afterWrite: (fn: (row: RowOf<T>) => Hook<void>) => {
          callbacks.push(fn)
        },
        afterCommit: (fn: AfterCommitFn<RowOf<T>>) => {
          onCommit.push(fn)
        },
      } as unknown as C
      const row = await write(ctx)
      written = { row }
      for (const fn of callbacks) await fn(row)
      await after(row, ctx)
      return row
    }
    let row: RowOf<T>
    try {
      row = this.def.transactional
        ? await (this.db as TransactionHost).$transaction((tx: never) =>
            exec(tx),
          )
        : await exec(this.db)
    } catch (error) {
      if (written && !this.def.transactional) {
        // The write is already persisted (no transaction to roll back).
        this.invalidateListCache(orgId)
        await this.runAfterCommit(committed, written.row, action)
      }
      this.mapWriteError(error, action)
      throw error
    }
    this.invalidateListCache(orgId)
    await this.runAfterCommit(committed, row, action)
    return row
  }

  /** Logger for `afterCommit` failures (override to plug your own). */
  protected readonly afterCommitLogger: Logger = new Logger(this.constructor.name)

  /** Run `afterCommit` callbacks in order; log and swallow their errors. */
  protected async runAfterCommit(
    fns: readonly AfterCommitFn<RowOf<T>>[],
    row: RowOf<T>,
    action: WriteAction,
  ): Promise<void> {
    for (const fn of fns) {
      try {
        await fn(row)
      } catch (error) {
        this.afterCommitLogger.error(
          `afterCommit callback failed (${this.def.model} ${action}): ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        )
      }
    }
  }

  /** P2002 → 409 per `resource.unique` (only for the configured actions). */
  protected mapWriteError(error: unknown, action: WriteAction): void {
    const unique = this.def.unique
    if (!unique) return
    const on = unique.on ?? ["create", "update"]
    if (!(on as readonly string[]).includes(action)) return
    mapPrismaUnique(
      error,
      unique.messages ?? {},
      unique.fallback ?? "Unique constraint violation",
    )
  }

  /** Declarative FK membership checks (`resource.relations`). */
  protected async checkRelations(
    action: "create" | "update",
    orgId: string,
    dto: unknown,
    host: DelegateHost,
  ): Promise<void> {
    const rules = this.def.relations
    if (!rules) return
    const data = (dto ?? {}) as Record<string, unknown>
    for (const [key, rule] of Object.entries(rules)) {
      if (rule.on && !rule.on.includes(action)) continue
      const value = data[key]
      const due = rule.required
        ? action === "create" || value !== undefined
        : value != null
      if (!due) continue
      // A missing required FK never matches (no `id: undefined` lookups).
      if (value == null) throw new NotFoundException(rule.message)
      await requireInOrg(
        delegateOf(host, rule.model),
        orgId,
        Number(value),
        rule.message,
      )
    }
  }

  protected invalidateListCache(orgId: string): void {
    const cfg = this.def.listCache
    if (cfg) this.listCache.invalidate(cfg.scope, orgId)
  }

  // ---------------------------------------------------------------- hooks

  /** Extra list where for this service. AND-merged; cannot change orgId. */
  protected scope(_orgId: string, _query: ListQuery): WhereClause {
    return {}
  }

  protected presentList(
    rows: RowOf<T>[],
    _ctx: ListContext,
  ): Hook<ListItemOf<T>[]> {
    return rows as unknown as ListItemOf<T>[]
  }

  protected presentOne(row: RowOf<T>, _ctx: PresentContext): Hook<OutputOf<T>> {
    return row as unknown as OutputOf<T>
  }

  /** Map the create DTO to Prisma data (`orgId` is added by the service). */
  protected beforeCreate(
    dto: CreateOf<T>,
    _ctx: CreateContext<RowOf<T>, TxOf<T>>,
  ): Hook<WriteData> {
    return { ...(dto as WriteData) }
  }

  protected afterCreate(
    _row: RowOf<T>,
    _ctx: CreateContext<RowOf<T>, TxOf<T>>,
  ): Hook<void> {}

  /** Map the update DTO to Prisma data. `ctx.existing` is the current row. */
  protected beforeUpdate(
    dto: UpdateOf<T>,
    _ctx: UpdateContext<RowOf<T>, TxOf<T>>,
  ): Hook<WriteData> {
    return { ...(dto as WriteData) }
  }

  protected afterUpdate(
    _row: RowOf<T>,
    _ctx: UpdateContext<RowOf<T>, TxOf<T>>,
  ): Hook<void> {}

  protected beforeDestroy(_ctx: DestroyContext<RowOf<T>, TxOf<T>>): Hook<void> {}

  protected afterDestroy(
    _row: RowOf<T>,
    _ctx: DestroyContext<RowOf<T>, TxOf<T>>,
  ): Hook<void> {}

  protected beforeApproval(_ctx: ApprovalContext<RowOf<T>, TxOf<T>>): Hook<void> {}

  protected afterApproval(
    _row: RowOf<T>,
    _ctx: ApprovalContext<RowOf<T>, TxOf<T>>,
  ): Hook<void> {}
}

/** Drop tenant / identity keys from a write payload. */
function stripKeys(data: WriteData): WriteData {
  const { orgId: _orgId, id: _id, ...rest } = data ?? {}
  return rest
}

/** `ctx.tx` as a delegate host (it is typed as the app's client in hooks). */
function hostOf(ctx: { tx: unknown }): DelegateHost {
  return ctx.tx as DelegateHost
}
