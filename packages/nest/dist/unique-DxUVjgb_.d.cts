/** Loose row shape — Prisma models are richer at the call site. */
type OrgRow = Record<string, unknown> & {
    id: number;
    orgId?: string;
};
/** Prisma-style `where` object. */
type WhereClause = Record<string, unknown>;
type SortDirection = "asc" | "desc";
/** Single field or Prisma-style multi-field orderBy. */
type OrderBy = Record<string, SortDirection> | Array<Record<string, SortDirection>>;
/** String keys of a row/DTO type (used to type field names in resources). */
type FieldOf<T> = Extract<keyof T, string>;
/**
 * Minimal Prisma-like model delegate used by the services / requireInOrg.
 * Real `PrismaService.product` etc. satisfy this structurally.
 *
 * `update` / `delete` take an extended unique where (`{ id, orgId }`, Prisma 5+)
 * so the tenant is enforced again at write time (defence in depth).
 */
type ModelDelegate = {
    findFirst(args: {
        where: WhereClause;
        include?: unknown;
        select?: unknown;
    }): Promise<OrgRow | null>;
    findMany(args: {
        where?: WhereClause;
        orderBy?: unknown;
        skip?: number;
        take?: number;
        include?: unknown;
        select?: unknown;
    }): Promise<OrgRow[]>;
    count(args: {
        where?: WhereClause;
    }): Promise<number>;
    create(args: {
        data: Record<string, unknown>;
        include?: unknown;
    }): Promise<OrgRow>;
    update(args: {
        where: {
            id: number;
            orgId?: string;
        };
        data: Record<string, unknown>;
        include?: unknown;
    }): Promise<OrgRow>;
    delete(args: {
        where: {
            id: number;
            orgId?: string;
        };
        include?: unknown;
    }): Promise<OrgRow>;
};
/**
 * Host that exposes named delegates (PrismaService or a transaction client).
 * Typed as `object` so concrete Prisma clients assign without an index signature.
 */
type DelegateHost = object;
/** Host that can open an interactive transaction (PrismaService). */
type TransactionHost = {
    $transaction<R>(fn: (tx: never) => Promise<R>): Promise<R>;
};
/** Resolve `host[model]` as a ModelDelegate (throws on unknown model). */
declare function delegateOf(host: DelegateHost, model: string): ModelDelegate;
/** Who performs a write (Clerk user + org role) — from the verified token. */
type Actor = {
    userId: string;
    orgRole?: string | null;
};

type FilterContext = {
    query: Record<string, unknown>;
    where: WhereClause;
    /** Resource field name when declared in a map key. */
    field?: string;
};
type FilterBackend = {
    apply(ctx: FilterContext): void;
};
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
declare const Filter: {
    /** `?brandId=3` when key is `brandId` → `{ brandId: 3 }` */
    exact(queryKey?: string): FilterBackend;
    /** `?minPrice=&maxPrice=` → `{ [field]: { gte, lte } }` */
    numberRange(minKey: string, maxKey: string): FilterBackend;
    /** `?createdAtFrom=&createdAtTo=` → UTC day bounds */
    dateRange(fromKey: string, toKey: string): FilterBackend;
    /** `?status=a,b` or array → `{ [field]: { in: [...] } }` */
    inList(queryKey?: string): FilterBackend;
    custom(fn: (ctx: FilterContext) => void): FilterBackend;
};
/**
 * Case-insensitive `contains` OR across `fields` (dotted paths allowed).
 * Blank / non-string `q` is a no-op.
 */
declare function applySearch(where: WhereClause, fields: readonly string[], q: unknown): void;

type ListCacheConfig = {
    /** Cache scope key, e.g. 'brands' — invalidate uses same scope. */
    scope: string;
    /** Override default TTL (5 min). */
    ttlMs?: number;
    /**
     * Scopes whose rows are embedded in this list (e.g. brands include
     * categories → `dependsOn: ['categories']`). A write that invalidates one
     * of them also invalidates this scope.
     */
    dependsOn?: readonly string[];
};
/** Field on the row, or a dotted relation path (`company.name`). */
type SearchPath<TRow> = FieldOf<TRow> | `${string}.${string}`;
/**
 * Declarative org-membership check for a foreign key in the create/update DTO.
 *
 * - `required: true` → checked on every create, and on update whenever the
 *   key is present (`!== undefined`).
 * - otherwise → checked only when the value is not null/undefined.
 *
 * Throws 404 `message` when `{ id, orgId }` does not exist in `model`.
 */
type RelationRule = {
    model: string;
    message: string;
    required?: boolean;
    /** Restrict to some write actions (default both). */
    on?: ReadonlyArray<"create" | "update">;
};
/** Which writes/reads use `include` (detail shape). */
type IncludeOn = {
    retrieve?: boolean;
    create?: boolean;
    update?: boolean;
    destroy?: boolean;
    approval?: boolean;
};
type UniqueConfig = {
    /** Field (or constraint-name substring) → 409 message; first match wins. */
    messages?: Record<string, string>;
    /** 409 message when no key matches (default: generic). */
    fallback?: string;
    /** Write actions mapped (default create + update). */
    on?: ReadonlyArray<"create" | "update">;
};
type SoftDeleteConfig = {
    /** Timestamp column set on destroy and filtered (null) on read. */
    field: string;
};
/**
 * One declarative description of an org-scoped resource.
 * `TRow` (optional) types field names: `defineResource<Product>({...})`.
 */
type ResourceDefinition<TRow extends object = Record<string, unknown>> = {
    /** Delegate name on PrismaService, e.g. 'product'. */
    model: string;
    notFoundMessage?: string;
    /** Fields matched by the search query param (default `q`). */
    search?: ReadonlyArray<SearchPath<TRow>>;
    /** Query key for search (default `q`, `?q=` is always accepted too). */
    searchParam?: string;
    /** Map of query param → filter backend (keys may be relation ids or aliases). */
    filters?: Record<string, FilterBackend>;
    /** Whitelist for `?sortBy=`. Anything else falls back to `defaultOrder`. */
    sortable?: ReadonlyArray<FieldOf<TRow>>;
    /** Legacy alias accepted for `sortDirection` (e.g. `sortOrder`). */
    sortDirectionParam?: string;
    defaultOrder?: OrderBy;
    /** Prisma include for the detail shape (retrieve + writes, see includeOn). */
    include?: unknown;
    /** Override when `include` is applied (default: all but destroy). */
    includeOn?: IncludeOn;
    /** Prisma include for list rows (default: `include`). */
    listInclude?: unknown;
    /** Prisma select for list rows (wins over listInclude). */
    listSelect?: unknown;
    /** Opt-in org list cache (writes invalidate the scope). */
    listCache?: ListCacheConfig;
    /** `paginated` (default) → `{ data, pagination }`; `all` → plain array. */
    listMode?: "paginated" | "all";
    /** Run writes (+ hooks) in one `$transaction`; hooks get `ctx.tx`. */
    transactional?: boolean;
    /** Map Prisma P2002 to 409 with readable messages. */
    unique?: UniqueConfig;
    /** Org-membership checks for FK fields in the DTOs. */
    relations?: Record<string, RelationRule>;
    /** Soft delete instead of `delete`. */
    softDelete?: SoftDeleteConfig;
};
type DefinedResource<TRow extends object = Record<string, unknown>> = ResourceDefinition<TRow> & {
    notFoundMessage: string;
};
/** @deprecated use `ResourceDefinition`. */
type ResourceConfig = ResourceDefinition;
declare function defineResource<TRow extends object = Record<string, unknown>>(config: ResourceDefinition<TRow>): DefinedResource<TRow>;
/** Include for an action, honouring `includeOn`. */
declare function includeFor(resource: ResourceDefinition<never> | DefinedResource<never>, action: keyof IncludeOn): {
    include?: unknown;
};
/**
 * @deprecated use `buildListWhere` (query pipeline). Kept for callers of 0.1.
 * Always scopes by orgId.
 */
declare function buildWhereFromQuery(resource: DefinedResource<never> | DefinedResource, orgId: string, query?: Record<string, unknown>): WhereClause;
/** Resolve `?sortBy=&sortDirection=` against the whitelist. */
declare function resolveOrder$1(resource: DefinedResource<never> | DefinedResource, query?: Record<string, unknown>): OrderBy;

/** Raw list query (validated DTO or plain record). */
type ListQuery = Record<string, unknown>;
type QueryContext = {
    orgId: string;
    query: ListQuery;
    /** Mutable where being built. Tenancy is added after every strategy. */
    where: WhereClause;
};
/** One composable step of the list query pipeline. */
type QueryStrategy = (ctx: QueryContext) => void;
/** Built-in strategies. Services can add their own via `queryStrategies()`. */
declare const QueryStrategies: {
    /** `?q=` (or `?{param}=`) → OR of case-insensitive contains. */
    readonly search: (fields: readonly string[], param?: string) => QueryStrategy;
    /** Declarative filter backends keyed by prisma field. */
    readonly filters: (map: Partial<Record<string, FilterBackend>>) => QueryStrategy;
    /** Hide soft-deleted rows. */
    readonly softDelete: (field: string) => QueryStrategy;
    /** Extra where (service scope). AND-merged, so it cannot widen the query. */
    readonly where: (extra: WhereClause | ((ctx: QueryContext) => WhereClause)) => QueryStrategy;
};
/** Default strategies derived from a resource definition. */
declare function strategiesFor(resource: DefinedResource): QueryStrategy[];
/**
 * Run strategies, then apply tenancy LAST: `orgId` always comes from the
 * caller (token), whatever a strategy or scope wrote.
 */
declare function runStrategies(strategies: readonly QueryStrategy[], orgId: string, query?: ListQuery): WhereClause;
/** where for a resource list (+ optional service scope). */
declare function buildListWhere(resource: DefinedResource, orgId: string, query?: ListQuery, scope?: WhereClause): WhereClause;
/**
 * `?sortBy=` must be in `sortable`; direction is `sortDirection` (or the
 * resource's legacy alias, e.g. `sortOrder`), default `desc`.
 * Otherwise `defaultOrder`, else `{ createdAt: 'desc' }`.
 */
declare function resolveOrder(resource: DefinedResource, query?: ListQuery): OrderBy;
type ListPlan = {
    where: WhereClause;
    orderBy: OrderBy;
    page: number;
    limit: number;
    skip: number;
};
/** Full plan for a paginated list (where + order + page window). */
declare function planList(resource: DefinedResource, orgId: string, query?: ListQuery, strategies?: readonly QueryStrategy[]): ListPlan;

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
type PrismaUniqueLike = {
    code: string;
    meta?: {
        target?: string | string[];
        modelName?: string;
        driverAdapterError?: {
            cause?: {
                originalCode?: string;
                originalMessage?: string;
                kind?: string;
                constraint?: {
                    fields?: string[];
                    index?: string;
                } | string;
            };
        };
    };
};
declare function isPrismaUnique(error: unknown): error is PrismaUniqueLike;
/**
 * Column names and/or constraint/index name involved in a P2002, unquoted.
 * Works with both the classic `meta.target` and the driver-adapter shape.
 * Example (adapter): ['orgId', 'year', 'invoice_sequences_pkey'].
 */
declare function prismaUniqueFields(error: unknown): string[];
/** True when the P2002 involves `field` (column or constraint-name substring). */
declare function prismaUniqueIncludes(error: unknown, field: string): boolean;
/**
 * If `error` is Prisma P2002, throw ConflictException with a field-specific
 * message. Otherwise return (caller should rethrow).
 * Keys are matched in declaration order, so put the most specific key first.
 */
declare function mapPrismaUnique(error: unknown, messages: Record<string, string>, fallback?: string): void;
/** Build a classic P2002-shaped error (tests / in-memory stores). */
declare function prismaUniqueError(fields: string[]): PrismaUniqueLike & Error;
/** Build a Prisma-7 driver-adapter P2002 (tests). */
declare function prismaAdapterUniqueError(fields: string[], constraintName: string, modelName?: string): PrismaUniqueLike & Error;

export { type Actor as A, resolveOrder$1 as B, resolveOrder as C, type DelegateHost as D, runStrategies as E, type FieldOf as F, strategiesFor as G, type IncludeOn as I, type ListQuery as L, type ModelDelegate as M, type OrgRow as O, type PrismaUniqueLike as P, type QueryStrategy as Q, type RelationRule as R, type SearchPath as S, type TransactionHost as T, type UniqueConfig as U, type WhereClause as W, type DefinedResource as a, Filter as b, type FilterBackend as c, type FilterContext as d, type ListCacheConfig as e, type ListPlan as f, type OrderBy as g, type QueryContext as h, QueryStrategies as i, type ResourceConfig as j, type ResourceDefinition as k, type SoftDeleteConfig as l, type SortDirection as m, applySearch as n, buildListWhere as o, buildWhereFromQuery as p, defineResource as q, delegateOf as r, includeFor as s, isPrismaUnique as t, mapPrismaUnique as u, planList as v, prismaAdapterUniqueError as w, prismaUniqueError as x, prismaUniqueFields as y, prismaUniqueIncludes as z };
