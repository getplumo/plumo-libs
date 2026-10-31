import { O as OrgRow, M as ModelDelegate, D as DelegateHost, A as Actor, L as ListQuery, a as DefinedResource, I as IncludeOn, Q as QueryStrategy, W as WhereClause } from './unique-CbQBBGrc.js';
export { E as ExactFilterOptions, F as FieldOf, b as Filter, c as FilterBackend, d as FilterContext, e as FilterValueType, f as InListFilterOptions, g as ListCacheConfig, h as ListPlan, i as OrderBy, P as PrismaUniqueLike, j as QueryContext, k as QueryStrategies, R as RangeFilterOptions, l as RelationRule, m as ResourceConfig, n as ResourceDefinition, S as SearchPath, o as SoftDeleteConfig, p as SortDirection, T as TransactionHost, U as UniqueConfig, q as UniqueConflictBody, r as applySearch, s as buildListWhere, t as buildWhereFromQuery, u as coerceFilterValue, v as defineResource, w as delegateOf, x as includeFor, y as isPrismaUnique, z as mapPrismaUnique, B as planList, C as prismaAdapterUniqueError, G as prismaUniqueColumns, H as prismaUniqueConstraints, J as prismaUniqueError, K as prismaUniqueFields, N as prismaUniqueIncludes, V as prismaUniqueMatches, X as resolveOrder, Y as runStrategies, Z as strategiesFor } from './unique-CbQBBGrc.js';
import { Logger, Type } from '@nestjs/common';

/**
 * Decimal-safe numeric helpers. Prisma returns `Decimal` objects (decimal.js)
 * for numeric columns; `Number(decimal)` works but is easy to forget, and
 * float maths on money drifts. Hooks should use these helpers.
 */
/** Anything Prisma may hand back for a numeric column. */
type DecimalLike = number | string | bigint | {
    toNumber(): number;
} | {
    toString(): string;
};
/** Convert a Decimal / string / number to a JS number (null/undefined → 0). */
declare function toNumber(value: DecimalLike | null | undefined): number;
/** Money → integer centimes (rounding half away from zero like Math.round). */
declare function toCents(value: DecimalLike | null | undefined): number;
/** Integer centimes → money number with 2 decimals. */
declare function fromCents(cents: number): number;
/** Sum money values without float drift (adds in centimes). */
declare function sumMoney(values: Iterable<DecimalLike | null | undefined>): number;

declare const DEFAULT_PAGE = 1;
declare const DEFAULT_LIMIT = 20;
declare const MAX_LIMIT = 100;
type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};
type PaginatedResult<T> = {
    data: T[];
    pagination: PaginationMeta;
};
/** Mix into Find*QueryDto — same idea as DRF pagination query params. */
declare class PaginationQueryDto {
    page?: number;
    limit?: number;
}
declare class SortQueryDto extends PaginationQueryDto {
    sortBy?: string;
    sortDirection?: "asc" | "desc";
}
declare function resolvePagination(query?: {
    page?: number;
    limit?: number;
}): {
    page: number;
    limit: number;
    skip: number;
};
declare function paginatedResult<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T>;

/** Minimal surface for membership checks. */
type OrgScopedDelegate = {
    findFirst(args: {
        where: Record<string, unknown>;
    }): Promise<OrgRow | null>;
    findMany?(args: {
        where: Record<string, unknown>;
    }): Promise<OrgRow[]>;
};
/**
 * Load a row by `{ id, orgId }` or throw NotFound.
 * Replaces private `assertXInOrg` / findOne NotFound helpers across modules.
 */
declare function requireInOrg(delegate: OrgScopedDelegate, orgId: string, id: number, message?: string): Promise<OrgRow>;
/** Alias — same as requireInOrg for related FKs (company, brand, taxRate, …). */
declare const requireRelatedInOrg: typeof requireInOrg;
/**
 * Ensure every id belongs to org. Empty list is a no-op.
 * Replaces `assertProductsInOrg` / multi-id membership checks.
 */
declare function requireAllRelatedInOrg(delegate: OrgScopedDelegate, orgId: string, ids: number[], message?: string): Promise<OrgRow[]>;
/** Convenience: requireInOrg typed against a full ModelDelegate. */
declare function requireInOrgModel(delegate: ModelDelegate, orgId: string, id: number, message?: string): Promise<OrgRow>;

/** Shape the app's auth guard puts on `req.auth` (Clerk). */
type AuthLike = {
    userId?: string | null;
    orgId?: string | null;
    orgRole?: string | null;
};
/** Resolve the active org from the verified token only (never the query). */
declare function orgIdFromAuth(auth: AuthLike | undefined): string;
/**
 * `@CurrentOrgId()` — active organization from the token. 403 when none.
 * A client `?orgId=` / body `orgId` is never consulted.
 */
declare const CurrentOrgId: (...dataOrPipes: unknown[]) => ParameterDecorator;
/** `@CurrentActor()` — `{ userId, orgRole }` from the token. */
declare const CurrentActor: (...dataOrPipes: unknown[]) => ParameterDecorator;

type ApprovalStatusValue = "pending" | "approved" | "rejected";
/** The only accepted approval statuses. */
declare const APPROVAL_STATUSES: readonly ApprovalStatusValue[];
declare function isApprovalStatus(value: unknown): value is ApprovalStatusValue;
/** 400 unless `value` is pending / approved / rejected (works without a DTO). */
declare function assertApprovalStatus(value: unknown): asserts value is ApprovalStatusValue;
type ApprovalActor = {
    userId: string;
    orgRole?: string | null;
};
type ApprovalFields = {
    createdBy: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    approvalStatus: ApprovalStatusValue;
};
type ApprovalStatusPatch = {
    approvedBy: string | null;
    approvedAt: Date | null;
    approvalStatus: ApprovalStatusValue;
};
/** Mirror Clerk org roles used by obs-api-v2 (no API import). */
declare const ApprovalRole: {
    readonly ADMIN: "org:admin";
    readonly MANAGER: "org:manager";
    readonly POS: "org:pos";
};
/** Manager/Admin/POS creates → auto-approved; others → pending. */
declare function approvalOnCreate(actor: ApprovalActor): ApprovalFields;
declare function approvalOnApprove(approverUserId: string): {
    approvedBy: string;
    approvedAt: Date;
    approvalStatus: "approved";
};
declare function canSetApprovalStatus(orgRole?: string | null): boolean;
/**
 * Build DB patch for an approval status change.
 * Throws 400 when `next` is not pending/approved/rejected.
 * Returns null when status is unchanged. Throws 403 if actor cannot approve.
 */
declare function buildApprovalStatusPatch(current: ApprovalStatusValue, next: ApprovalStatusValue, actor: ApprovalActor): ApprovalStatusPatch | null;
type ApprovalRow = {
    approvalStatus: ApprovalStatusValue;
};
/**
 * Shared updateApproval flow used by quotes/orders/DN/invoices/payments/expenses.
 */
declare function applyApprovalUpdate<T extends ApprovalRow>(current: T, next: ApprovalStatusValue, actor: ApprovalActor, update: (patch: ApprovalStatusPatch) => Promise<T>): Promise<T>;

type OrgListCacheOptions = {
    ttlMs?: number;
};
/** Optional DI token: `{ provide: ORG_LIST_CACHE_CONFIG, useValue: {...} }`. */
declare const ORG_LIST_CACHE_CONFIG: unique symbol;
type OrgListCacheConfig = {
    /** Default TTL for every scope (5 min). Per-resource `ttlMs` still wins. */
    defaultTtlMs?: number;
    /** Max entries before LRU eviction (500). */
    maxEntries?: number;
    /** `false` turns the cache into a pass-through (e.g. >1 API instance). */
    enabled?: boolean;
};
/**
 * In-memory org-scoped list cache.
 * Opt-in via defineResource({ listCache: { scope } }) — CUD auto-invalidates.
 *
 * PER PROCESS: with more than one API instance, other replicas keep serving
 * their own copy until TTL expiry. Run a single instance, use a short TTL, or
 * construct it with `{ enabled: false }`.
 */
declare class OrgListCache {
    private readonly store;
    /** scope → scopes whose cached lists embed it (e.g. categories → brands). */
    private readonly dependents;
    private readonly defaultTtlMs;
    private readonly maxEntries;
    private readonly enabled;
    constructor(config?: OrgListCacheConfig);
    /**
     * Declare that lists cached under `scope` embed rows of `dependsOn`
     * scopes, so invalidating any of those also clears `scope`.
     */
    registerDependencies(scope: string, dependsOn: readonly string[]): void;
    getOrSet<T>(scope: string, orgId: string, variant: unknown, load: () => Promise<T>, options?: OrgListCacheOptions): Promise<T>;
    /** Clears `scope` for `orgId`, plus every scope that depends on it. */
    invalidate(scope: string, orgId: string, seen?: Set<string>): void;
    private set;
    private evict;
    private key;
}
/** Optional singleton when Nest DI is not used. */
declare const defaultOrgListCache: OrgListCache;

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
type ResourceTypes = {
    row: object;
    create?: object;
    update?: object;
    output?: unknown;
    listItem?: unknown;
    tx?: unknown;
};
type RowOf<T extends ResourceTypes> = T["row"];
type CreateOf<T extends ResourceTypes> = T extends {
    create: infer C;
} ? C : Record<string, unknown>;
type UpdateOf<T extends ResourceTypes> = T extends {
    update: infer U;
} ? U : Partial<CreateOf<T>>;
type OutputOf<T extends ResourceTypes> = T extends {
    output: infer O;
} ? O : RowOf<T>;
type ListItemOf<T extends ResourceTypes> = T extends {
    listItem: infer L;
} ? L : RowOf<T>;
type TxOf<T extends ResourceTypes> = T extends {
    tx: infer X;
} ? X : DelegateHost;
/** Data handed to Prisma `create` / `update` (orgId/id are stripped/forced). */
type WriteData = Record<string, unknown>;
type WriteAction = "create" | "update" | "destroy" | "approval";
/** Shared by every write hook. */
type WriteContext<TRow, TTx = DelegateHost> = {
    orgId: string;
    /** From the verified token; absent for system writes. */
    actor?: Actor;
    /**
     * Prisma client to use inside hooks: the interactive transaction client
     * when the resource is `transactional`, otherwise the service's client.
     */
    tx: TTx;
    /**
     * Register work to run right after the row is written, **inside** the same
     * transaction (e.g. stock moves, cache tables). Runs before `after*` hooks.
     * A throw here rolls the whole write back (when `transactional`) and is
     * returned to the client. Not for side effects that must only happen once
     * the data is durable — use `afterCommit` for those.
     */
    afterWrite(fn: (row: TRow) => void | Promise<void>): void;
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
    afterCommit(fn: AfterCommitFn<TRow>): void;
};
/** Callback registered with `ctx.afterCommit`. */
type AfterCommitFn<TRow> = (row: TRow) => void | Promise<void>;
type CreateContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
    action: "create";
};
type UpdateContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
    action: "update";
    id: number;
    /** Row before the write (loaded with the resource include). */
    existing: TRow;
};
type DestroyContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
    action: "destroy";
    id: number;
    existing: TRow;
};
type ApprovalChange = {
    from: ApprovalStatusValue;
    to: ApprovalStatusValue;
    patch: ApprovalStatusPatch;
};
type ApprovalContext<TRow, TTx = DelegateHost> = WriteContext<TRow, TTx> & {
    action: "approval";
    id: number;
    existing: TRow;
    change: ApprovalChange;
};
type PresentAction = "retrieve" | "create" | "update" | "approval";
type PresentContext = {
    orgId: string;
    action: PresentAction;
};
type ListContext = {
    orgId: string;
    query: ListQuery;
};

/** `list()` result: `{ data, pagination }`, or a plain array for `listMode: 'all'`. */
type ResourceList<TItem> = PaginatedResult<TItem> | TItem[];
type Hook<T> = T | Promise<T>;
/** Body of `PATCH :id/approval`. */
type ApprovalInput = {
    approvalStatus: ApprovalStatusValue | string;
};
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
declare class OrgResourceService<T extends ResourceTypes = {
    row: OrgRow;
}> {
    protected readonly db: DelegateHost;
    protected readonly resource: DefinedResource<never> | DefinedResource;
    protected readonly listCache: OrgListCache;
    constructor(db: DelegateHost, resource: DefinedResource<never> | DefinedResource, listCache?: OrgListCache);
    /** Resource definition with field names widened to string. */
    protected get def(): DefinedResource;
    /** Model delegate on the service client (or on `host`, e.g. a tx). */
    protected delegate(host?: DelegateHost): ModelDelegate;
    list(orgId: string, query?: ListQuery): Promise<ResourceList<ListItemOf<T>>>;
    retrieve(orgId: string, id: number): Promise<OutputOf<T>>;
    /**
     * Load `{ id, orgId }` (with the include configured for `action`) or throw
     * 404. Writes call this before opening the transaction.
     */
    protected findOrFail(orgId: string, id: number, action?: keyof IncludeOn, host?: DelegateHost): Promise<RowOf<T>>;
    /** Strategies for the list where. Tenancy is always applied after them. */
    protected queryStrategies(): QueryStrategy[];
    /** Prisma select/include for list rows. */
    protected listShape(): {
        select?: unknown;
        include?: unknown;
    };
    protected loadAll(orgId: string, query: ListQuery): Promise<ListItemOf<T>[]>;
    protected loadPage(orgId: string, query: ListQuery): Promise<PaginatedResult<ListItemOf<T>>>;
    create(orgId: string, dto: CreateOf<T>, actor?: Actor): Promise<OutputOf<T>>;
    update(orgId: string, id: number, dto: UpdateOf<T>, actor?: Actor): Promise<OutputOf<T>>;
    /** Returns the deleted row (not presented), like 0.1. */
    destroy(orgId: string, id: number, actor?: Actor): Promise<RowOf<T>>;
    /**
     * Approval workflow (`PATCH :id/approval`). Status other than
     * pending/approved/rejected → 400. Unchanged status → returns the
     * current row (no write). Otherwise checks the actor role (403), runs
     * `beforeApproval`, writes the patch and `afterApproval`.
     */
    updateApproval(orgId: string, id: number, dto: ApprovalInput, actor: Actor): Promise<OutputOf<T>>;
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
    protected runWrite<C extends WriteContext<RowOf<T>, TxOf<T>>>(action: WriteAction, orgId: string, actor: Actor | undefined, extra: Omit<C, keyof WriteContext<RowOf<T>, TxOf<T>> | "action">, write: (ctx: C) => Promise<RowOf<T>>, after: (row: RowOf<T>, ctx: C) => Hook<void>): Promise<RowOf<T>>;
    /** Logger for `afterCommit` failures (override to plug your own). */
    protected readonly afterCommitLogger: Logger;
    /** Run `afterCommit` callbacks in order; log and swallow their errors. */
    protected runAfterCommit(fns: readonly AfterCommitFn<RowOf<T>>[], row: RowOf<T>, action: WriteAction): Promise<void>;
    /** P2002 → 409 per `resource.unique` (only for the configured actions). */
    protected mapWriteError(error: unknown, action: WriteAction): void;
    /** Declarative FK membership checks (`resource.relations`). */
    protected checkRelations(action: "create" | "update", orgId: string, dto: unknown, host: DelegateHost): Promise<void>;
    protected invalidateListCache(orgId: string): void;
    /** Extra list where for this service. AND-merged; cannot change orgId. */
    protected scope(_orgId: string, _query: ListQuery): WhereClause;
    protected presentList(rows: RowOf<T>[], _ctx: ListContext): Hook<ListItemOf<T>[]>;
    protected presentOne(row: RowOf<T>, _ctx: PresentContext): Hook<OutputOf<T>>;
    /** Map the create DTO to Prisma data (`orgId` is added by the service). */
    protected beforeCreate(dto: CreateOf<T>, _ctx: CreateContext<RowOf<T>, TxOf<T>>): Hook<WriteData>;
    protected afterCreate(_row: RowOf<T>, _ctx: CreateContext<RowOf<T>, TxOf<T>>): Hook<void>;
    /** Map the update DTO to Prisma data. `ctx.existing` is the current row. */
    protected beforeUpdate(dto: UpdateOf<T>, _ctx: UpdateContext<RowOf<T>, TxOf<T>>): Hook<WriteData>;
    protected afterUpdate(_row: RowOf<T>, _ctx: UpdateContext<RowOf<T>, TxOf<T>>): Hook<void>;
    protected beforeDestroy(_ctx: DestroyContext<RowOf<T>, TxOf<T>>): Hook<void>;
    protected afterDestroy(_row: RowOf<T>, _ctx: DestroyContext<RowOf<T>, TxOf<T>>): Hook<void>;
    protected beforeApproval(_ctx: ApprovalContext<RowOf<T>, TxOf<T>>): Hook<void>;
    protected afterApproval(_row: RowOf<T>, _ctx: ApprovalContext<RowOf<T>, TxOf<T>>): Hook<void>;
}

type NestedResourceConfig = {
    /** Parent model key on PrismaService (e.g. 'savTicket'). */
    parentModel: string;
    /** Child model key (e.g. 'savTicketComment'). */
    childModel: string;
    /** FK on child pointing at parent id (e.g. 'ticketId'). */
    parentFk: string;
    parentNotFound?: string;
    childNotFound?: string;
};
/**
 * Nested child CRUD under an org-scoped parent
 * (SAV comments, opportunity activities, …).
 */
declare class OrgNestedCrudService {
    protected readonly db: DelegateHost;
    protected readonly config: NestedResourceConfig;
    constructor(db: DelegateHost, config: NestedResourceConfig);
    protected get parentDelegate(): ModelDelegate;
    protected get childDelegate(): ModelDelegate;
    protected delegate(model: string): ModelDelegate;
    protected requireParent(orgId: string, parentId: number): Promise<OrgRow>;
    protected requireChild(orgId: string, parentId: number, childId: number): Promise<OrgRow>;
    listChildren(orgId: string, parentId: number): Promise<OrgRow[]>;
    createChild(orgId: string, parentId: number, data: Record<string, unknown>): Promise<OrgRow>;
    updateChild(orgId: string, parentId: number, childId: number, data: Record<string, unknown>): Promise<OrgRow>;
    destroyChild(orgId: string, parentId: number, childId: number): Promise<OrgRow>;
}

/** Standard routes generated by `OrgResourceController`. */
type ResourceRoute = "list" | "retrieve" | "create" | "update" | "destroy" | "approval";
/** Handler method name used for each route (kept from the 0.1 controllers). */
declare const RESOURCE_ROUTE_METHOD: {
    readonly list: "findAll";
    readonly retrieve: "findOne";
    readonly create: "create";
    readonly update: "update";
    readonly destroy: "remove";
    readonly approval: "updateApproval";
};
type RouteOptions = {
    /** Extra method decorators (permissions, swagger, throttling…). */
    decorators?: Array<MethodDecorator>;
};
/** Surface the generated handlers call on `this.service`. */
interface ResourceServiceLike {
    list(orgId: string, query: Record<string, unknown>): unknown;
    retrieve(orgId: string, id: number): unknown;
    create(orgId: string, dto: never, actor: Actor): unknown;
    update(orgId: string, id: number, dto: never, actor: Actor): unknown;
    destroy(orgId: string, id: number, actor: Actor): unknown;
    updateApproval?(orgId: string, id: number, dto: never, actor: Actor): unknown;
}
type RequestContext = {
    route: ResourceRoute;
    orgId: string;
    actor: Actor;
};
type OrgResourceControllerOptions = {
    /** Body DTO for `POST /` (validated by the global ValidationPipe). */
    create?: Type<unknown>;
    /** Body DTO for `PATCH /:id`. */
    update?: Type<unknown>;
    /** Query DTO for `GET /`. Omit to accept an unvalidated record (0.1 behaviour). */
    query?: Type<unknown>;
    /** Body DTO for `PATCH /:id/approval` (enables the route). */
    approval?: Type<unknown>;
    /**
     * Per-route switch / options. `false` removes the route (define your own
     * method with the same name to replace it). `approval` is on only when an
     * `approval` DTO is given.
     */
    routes?: Partial<Record<ResourceRoute, boolean | RouteOptions>>;
    /** Decorators applied to every generated route. */
    decorators?: Array<MethodDecorator>;
    /**
     * `:id` parsing. `int` (default) → ParseIntPipe (400 on non-integers).
     * `number` → legacy `+id` without a pipe (kept for controllers that had no
     * pipe, so error codes stay identical).
     */
    id?: "int" | "number";
    /** Runs first in every generated handler (e.g. a role check). */
    onRequest?: (ctx: RequestContext) => void;
};
/** Instance type of a generated controller base. */
interface OrgResourceControllerBase {
    readonly service: ResourceServiceLike;
}
/**
 * Controller mixin that generates the standard org-scoped routes:
 *
 * ```ts
 * @Controller('categories')
 * @RequirePermissions(CATALOG_MANAGE)
 * export class CategoriesController extends OrgResourceController({
 *   create: CreateCategoryDto,
 *   update: UpdateCategoryDto,
 *   routes: { list: { decorators: [RequireAnyPermission(CATALOG_MANAGE, POS_ACCESS)] } },
 * }) {
 *   constructor(readonly service: CategoriesService) { super() }
 * }
 * ```
 *
 * `orgId` always comes from the token (`@CurrentOrgId`). `design:paramtypes`
 * is set to the given DTOs, so the global ValidationPipe validates (and
 * whitelists) exactly as a hand-written controller would. Extra routes
 * declared on the subclass are registered before the generated ones, so
 * static paths like `GET low-stock` win over `GET :id`.
 */
declare function OrgResourceController(options?: OrgResourceControllerOptions): abstract new () => OrgResourceControllerBase;

type ListResult = PaginatedResult<OrgRow> | OrgRow[];
/**
 * DRF ModelViewSet analogue — org-scoped CRUD (0.1 API).
 *
 * @deprecated Use `OrgResourceService` (typed, lifecycle hooks, transactions).
 * Kept for backward compatibility. Since 0.2 it also enforces the tenant on
 * writes (`where: { id, orgId }`) and applies `extraWhere` before tenancy, so
 * it can no longer override `orgId`.
 */
declare class OrgCrudService {
    protected readonly db: DelegateHost;
    protected readonly resource: DefinedResource;
    protected readonly listCache: OrgListCache;
    constructor(db: DelegateHost, resource: DefinedResource, listCache?: OrgListCache);
    protected get delegate(): ModelDelegate;
    protected get listMode(): "paginated" | "all";
    /**
     * List rows for org.
     * - `listMode: 'paginated'` (default) → `{ data, pagination }`
     * - `listMode: 'all'` → full array (filters/search still apply; no skip/take)
     */
    list(orgId: string, query?: Record<string, unknown>): Promise<ListResult>;
    protected buildListWhere(orgId: string, query: Record<string, unknown>): Record<string, unknown>;
    protected listFindArgs(where: Record<string, unknown>, orderBy: unknown): {
        select: {};
        where: Record<string, unknown>;
        orderBy: unknown;
    } | {
        include: {};
        where: Record<string, unknown>;
        orderBy: unknown;
    } | {
        where: Record<string, unknown>;
        orderBy: unknown;
    };
    protected loadListAll(orgId: string, query: Record<string, unknown>): Promise<OrgRow[]>;
    protected loadListPage(orgId: string, query: Record<string, unknown>): Promise<PaginatedResult<OrgRow>>;
    retrieve(orgId: string, id: number): Promise<OrgRow>;
    /**
     * `data` is `any` and trailing args are open so domain services can use
     * concrete DTOs + ApprovalActor without TS2416.
     */
    create(orgId: string, data: any, ..._extra: any[]): Promise<OrgRow>;
    update(orgId: string, id: number, data: any, ..._extra: any[]): Promise<OrgRow>;
    destroy(orgId: string, id: number): Promise<OrgRow>;
    protected invalidateListCache(orgId: string): void;
    protected extraWhere(_orgId: string, _query: Record<string, unknown>): Record<string, unknown>;
    protected transformListItem(row: OrgRow): OrgRow;
    protected transformDetail(row: OrgRow): OrgRow;
    protected assertCreate(_orgId: string, _data: Record<string, unknown>): Promise<void>;
    protected assertUpdate(_orgId: string, _id: number, _data: Record<string, unknown>): Promise<void>;
    protected mapCreateData(_orgId: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
    protected mapUpdateData(_orgId: string, _id: number, data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** Minimal request shape — Clerk AuthGuard sets `auth.orgId`. */
type AuthLikeRequest = {
    auth?: {
        orgId?: string | null;
        orgRole?: string | null;
    };
};
/**
 * Optional base controller for org-scoped CRUD.
 *
 * Body/query typed as `any` so subclasses can use concrete DTOs without
 * TS2416 (parameter contravariance).
 *
 * The tenant comes ONLY from the verified token (`req.auth.orgId`, set by the
 * app's auth guard). A client-supplied `?orgId=` is never trusted: it is
 * stripped from list queries and ignored everywhere else. The `query`
 * parameters are kept on every handler for backwards compatibility with
 * subclasses that forward them; they are not used to pick the tenant.
 *
 * @deprecated Use `OrgResourceController({ create, update, query })` (typed DTOs, per-route decorators).
 */
declare abstract class OrgCrudController {
    protected abstract readonly service: OrgCrudService;
    protected resolveOrgId(req: AuthLikeRequest, _query?: Record<string, unknown>): string;
    create(req: AuthLikeRequest, body: any, query: any): Promise<OrgRow>;
    findAll(req: AuthLikeRequest, query: any): Promise<ListResult>;
    findOne(req: AuthLikeRequest, id: number, query: any): Promise<OrgRow>;
    update(req: AuthLikeRequest, id: number, body: any, query: any): Promise<OrgRow>;
    remove(req: AuthLikeRequest, id: number, query: any): Promise<OrgRow>;
}

/**
 * Low-level paginated findMany + count (for services that skip OrgCrudService).
 *
 * @deprecated Use `OrgResourceService` or `planList`.
 */
declare function findManyPaginated(delegate: ModelDelegate, args: {
    where?: Record<string, unknown>;
    orderBy?: unknown;
    include?: unknown;
    select?: unknown;
    page?: number;
    limit?: number;
}): Promise<PaginatedResult<OrgRow>>;

/**
 * Shared create payload bits for approvable trade/finance docs.
 * Amount normalization stays in the app via `@plumo/money` — pass already-normalized values.
 *
 * @deprecated Use `approvalOnCreate(actor)` inside a `beforeCreate` hook.
 */
declare function mapApprovableCreate(data: Record<string, unknown>, extras: {
    numberField: string;
    numberPrefix: string;
    nextSeq: number;
    amountField?: string;
}): Record<string, unknown>;
/** @deprecated Use `OrgResourceService.updateApproval`. */
declare function runApprovalUpdate(row: OrgRow & {
    approvalStatus: ApprovalStatusValue;
}, next: ApprovalStatusValue, actor: ApprovalActor, update: (patch: ApprovalStatusPatch) => Promise<OrgRow>): Promise<OrgRow>;
/** @deprecated Actors are passed as the 3rd argument of create/update. */
declare function withActor(data: Record<string, unknown>, actor?: ApprovalActor): Record<string, unknown>;

/**
 * Shared Find* query for trade docs (quotes / orders / BL / invoices / returns).
 *
 * @deprecated Declare a per-resource Find*QueryDto in the app.
 */
declare class TradeListQueryDto extends SortQueryDto {
    q?: string;
    type?: "sell" | "buy";
    status?: string;
    companyId?: number;
    minTotalAmount?: number;
    maxTotalAmount?: number;
    createdAtFrom?: string;
    createdAtTo?: string;
    orgId?: string;
}
/** Shared line item shape — math stays in @plumo/money. *
 * @deprecated Declare line-item DTOs in the app.
 */
declare class CreateTradeLineItemDto {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRatePercent?: number;
}
declare class UpdateApprovalDto {
    approvalStatus: "pending" | "approved" | "rejected";
}

export { APPROVAL_STATUSES, Actor, type AfterCommitFn, type ApprovalActor, type ApprovalChange, type ApprovalContext, type ApprovalFields, type ApprovalInput, ApprovalRole, type ApprovalStatusPatch, type ApprovalStatusValue, type AuthLike, type CreateContext, type CreateOf, CreateTradeLineItemDto, CurrentActor, CurrentOrgId, DEFAULT_LIMIT, DEFAULT_PAGE, type DecimalLike, DefinedResource, DelegateHost, type DestroyContext, IncludeOn, type ListContext, type ListItemOf, ListQuery, type ListResult, MAX_LIMIT, ModelDelegate, type NestedResourceConfig, ORG_LIST_CACHE_CONFIG, OrgCrudController, OrgCrudService, OrgListCache, type OrgListCacheConfig, type OrgListCacheOptions, OrgNestedCrudService, OrgResourceController, type OrgResourceControllerBase, type OrgResourceControllerOptions, OrgResourceService, OrgRow, type OrgScopedDelegate, type OutputOf, type PaginatedResult, type PaginationMeta, PaginationQueryDto, type PresentAction, type PresentContext, QueryStrategy, RESOURCE_ROUTE_METHOD, type RequestContext, type ResourceList, type ResourceRoute, type ResourceServiceLike, type ResourceTypes, type RouteOptions, type RowOf, SortQueryDto, TradeListQueryDto, type TxOf, UpdateApprovalDto, type UpdateContext, type UpdateOf, WhereClause, type WriteAction, type WriteContext, type WriteData, applyApprovalUpdate, approvalOnApprove, approvalOnCreate, assertApprovalStatus, buildApprovalStatusPatch, canSetApprovalStatus, defaultOrgListCache, findManyPaginated, fromCents, isApprovalStatus, mapApprovableCreate, orgIdFromAuth, paginatedResult, requireAllRelatedInOrg, requireInOrg, requireInOrgModel, requireRelatedInOrg, resolvePagination, runApprovalUpdate, sumMoney, toCents, toNumber, withActor };
