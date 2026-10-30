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

type WhereClause = Record<string, unknown>;
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
declare function applySearch(where: WhereClause, fields: string[], q: unknown): void;

type ListCacheConfig = {
    /** Cache scope key, e.g. 'brands' — invalidate uses same scope. */
    scope: string;
    /** Override default TTL (5 min). */
    ttlMs?: number;
};
type ResourceConfig = {
    /** Logical model name (also key on PrismaService), e.g. 'product'. */
    model: string;
    notFoundMessage?: string;
    /** Fields matched by search query param (default `q`) */
    search?: string[];
    /** Query key for search (default `q`). Use `search` when API already exposes `?search=`. */
    searchParam?: string;
    /** Map of prisma field → filter backend */
    filters?: Record<string, FilterBackend>;
    sortable?: string[];
    /** Single field or Prisma-style multi-field orderBy. */
    defaultOrder?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
    /** Prisma include for retrieve (and optionally list). */
    include?: unknown;
    /** Prisma select for list rows. */
    listSelect?: unknown;
    /**
     * Opt-in org list cache. When set, list() is cached by query variant;
     * create/update/destroy invalidate the scope for that org.
     */
    listCache?: ListCacheConfig;
    /**
     * `paginated` (default) → `{ data, pagination }`.
     * `all` → full `OrgRow[]` (no page/limit); typical for small cached catalogs.
     */
    listMode?: "paginated" | "all";
};
type DefinedResource = ResourceConfig & {
    notFoundMessage: string;
};
declare function defineResource(config: ResourceConfig): DefinedResource;
/** Always scopes by orgId — like DRF get_queryset().filter(org=…). */
declare function buildWhereFromQuery(resource: DefinedResource, orgId: string, query?: Record<string, unknown>): WhereClause;
type OrderBy = Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
declare function resolveOrder(resource: DefinedResource, query?: {
    sortBy?: string;
    sortDirection?: "asc" | "desc";
}): OrderBy;

/** Loose row shape — Prisma models are richer at the call site. */
type OrgRow = Record<string, unknown> & {
    id: number;
    orgId?: string;
};
/**
 * Minimal Prisma-like model delegate used by OrgCrudService / requireInOrg.
 * Real `PrismaService.product` etc. satisfy this structurally.
 */
type ModelDelegate = {
    findFirst(args: {
        where: Record<string, unknown>;
        include?: unknown;
        select?: unknown;
    }): Promise<OrgRow | null>;
    findMany(args: {
        where?: Record<string, unknown>;
        orderBy?: unknown;
        skip?: number;
        take?: number;
        include?: unknown;
        select?: unknown;
    }): Promise<OrgRow[]>;
    count(args: {
        where?: Record<string, unknown>;
    }): Promise<number>;
    create(args: {
        data: Record<string, unknown>;
        include?: unknown;
    }): Promise<OrgRow>;
    update(args: {
        where: {
            id: number;
        };
        data: Record<string, unknown>;
        include?: unknown;
    }): Promise<OrgRow>;
    delete(args: {
        where: {
            id: number;
        };
    }): Promise<OrgRow>;
};
/**
 * Host that exposes named delegates (PrismaService).
 * Typed as `object` so concrete Prisma clients assign without an index signature.
 */
type DelegateHost = object;

/**
 * Low-level paginated findMany + count (for services that skip OrgCrudService).
 */
declare function findManyPaginated(delegate: ModelDelegate, args: {
    where?: Record<string, unknown>;
    orderBy?: unknown;
    include?: unknown;
    select?: unknown;
    page?: number;
    limit?: number;
}): Promise<PaginatedResult<OrgRow>>;

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

type OrgListCacheOptions = {
    ttlMs?: number;
};
/**
 * In-memory org-scoped list cache.
 * Opt-in via defineResource({ listCache: { scope } }) — CUD auto-invalidates.
 */
declare class OrgListCache {
    private readonly store;
    getOrSet<T>(scope: string, orgId: string, variant: unknown, load: () => Promise<T>, options?: OrgListCacheOptions): Promise<T>;
    invalidate(scope: string, orgId: string): void;
    private set;
    private evict;
    private key;
}
/** Optional singleton when Nest DI is not used. */
declare const defaultOrgListCache: OrgListCache;

type ListResult = PaginatedResult<OrgRow> | OrgRow[];
/**
 * DRF ModelViewSet analogue — org-scoped CRUD.
 * Subclass only for domain hooks / extra actions.
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

type ApprovalStatusValue = "pending" | "approved" | "rejected";
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
 * Returns null when status is unchanged. Throws if actor cannot approve.
 */
declare function buildApprovalStatusPatch(current: ApprovalStatusValue, next: ApprovalStatusValue, actor: ApprovalActor): ApprovalStatusPatch | null;
type ApprovalRow = {
    approvalStatus: ApprovalStatusValue;
};
/**
 * Shared updateApproval flow used by quotes/orders/DN/invoices/payments/expenses.
 */
declare function applyApprovalUpdate<T extends ApprovalRow>(current: T, next: ApprovalStatusValue, actor: ApprovalActor, update: (patch: ApprovalStatusPatch) => Promise<T>): Promise<T>;

/**
 * Shared create payload bits for approvable trade/finance docs.
 * Amount normalization stays in the app via `@plumo/money` — pass already-normalized values.
 */
declare function mapApprovableCreate(data: Record<string, unknown>, extras: {
    numberField: string;
    numberPrefix: string;
    nextSeq: number;
    amountField?: string;
}): Record<string, unknown>;
declare function runApprovalUpdate(row: OrgRow & {
    approvalStatus: ApprovalStatusValue;
}, next: ApprovalStatusValue, actor: ApprovalActor, update: (patch: ApprovalStatusPatch) => Promise<OrgRow>): Promise<OrgRow>;
declare function withActor(data: Record<string, unknown>, actor?: ApprovalActor): Record<string, unknown>;

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

/**
 * Shared Find* query for trade docs (quotes / orders / BL / invoices / returns).
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
/** Shared line item shape — math stays in @plumo/money. */
declare class CreateTradeLineItemDto {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRatePercent?: number;
}
declare class UpdateApprovalDto {
    approvalStatus: "pending" | "approved" | "rejected";
}

export { type ApprovalActor, type ApprovalFields, ApprovalRole, type ApprovalStatusPatch, type ApprovalStatusValue, CreateTradeLineItemDto, DEFAULT_LIMIT, DEFAULT_PAGE, type DefinedResource, type DelegateHost, Filter, type FilterBackend, type FilterContext, type ListCacheConfig, type ListResult, MAX_LIMIT, type ModelDelegate, type NestedResourceConfig, type OrderBy, OrgCrudController, OrgCrudService, OrgListCache, type OrgListCacheOptions, OrgNestedCrudService, type OrgRow, type OrgScopedDelegate, type PaginatedResult, type PaginationMeta, PaginationQueryDto, type PrismaUniqueLike, type ResourceConfig, SortQueryDto, TradeListQueryDto, UpdateApprovalDto, type WhereClause, applyApprovalUpdate, applySearch, approvalOnApprove, approvalOnCreate, buildApprovalStatusPatch, buildWhereFromQuery, canSetApprovalStatus, defaultOrgListCache, defineResource, findManyPaginated, isPrismaUnique, mapApprovableCreate, mapPrismaUnique, paginatedResult, prismaAdapterUniqueError, prismaUniqueError, prismaUniqueFields, prismaUniqueIncludes, requireAllRelatedInOrg, requireInOrg, requireInOrgModel, requireRelatedInOrg, resolveOrder, resolvePagination, runApprovalUpdate, withActor };
