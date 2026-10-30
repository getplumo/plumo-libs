// Decorator metadata polyfill: dist reads Reflect.getMetadata at import time.
import "reflect-metadata"

// ─── Core types & helpers ────────────────────────────────────────────────
export { delegateOf } from "./core/types.js"
export type {
  OrgRow,
  ModelDelegate,
  DelegateHost,
  TransactionHost,
  WhereClause,
  OrderBy,
  SortDirection,
  FieldOf,
  Actor,
} from "./core/types.js"
export { toNumber, toCents, fromCents, sumMoney } from "./core/decimal.js"
export type { DecimalLike } from "./core/decimal.js"

// ─── Resource definition ─────────────────────────────────────────────────
export {
  defineResource,
  includeFor,
  resolveOrder,
  buildWhereFromQuery,
} from "./resource/resource.js"
export type {
  ResourceDefinition,
  DefinedResource,
  ResourceConfig,
  ListCacheConfig,
  RelationRule,
  UniqueConfig,
  IncludeOn,
  SoftDeleteConfig,
  SearchPath,
} from "./resource/resource.js"

// ─── Query pipeline (pagination, sort, search, filters) ──────────────────
export {
  PaginationQueryDto,
  SortQueryDto,
  resolvePagination,
  paginatedResult,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "./query/pagination.js"
export type { PaginatedResult, PaginationMeta } from "./query/pagination.js"
export { Filter, applySearch } from "./query/filters.js"
export type { FilterBackend, FilterContext } from "./query/filters.js"
export {
  QueryStrategies,
  buildListWhere,
  planList,
} from "./query/pipeline.js"
export type {
  ListQuery,
  QueryContext,
  QueryStrategy,
  ListPlan,
} from "./query/pipeline.js"

// ─── Tenancy ─────────────────────────────────────────────────────────────
export {
  requireInOrg,
  requireRelatedInOrg,
  requireAllRelatedInOrg,
  requireInOrgModel,
} from "./tenancy/require-in-org.js"
export type { OrgScopedDelegate } from "./tenancy/require-in-org.js"
export {
  CurrentOrgId,
  CurrentActor,
  orgIdFromAuth,
} from "./tenancy/decorators.js"
export type { AuthLike } from "./tenancy/decorators.js"

// ─── Service (typed CRUD + lifecycle hooks) ──────────────────────────────
export { OrgResourceService } from "./service/org-resource.service.js"
export type {
  ResourceList,
  ApprovalInput,
} from "./service/org-resource.service.js"
export type {
  ResourceTypes,
  RowOf,
  TxOf,
  CreateOf,
  UpdateOf,
  OutputOf,
  ListItemOf,
  WriteData,
  WriteAction,
  WriteContext,
  CreateContext,
  UpdateContext,
  DestroyContext,
  ApprovalContext,
  ApprovalChange,
  PresentContext,
  PresentAction,
  ListContext,
} from "./service/context.js"
export { OrgNestedCrudService } from "./service/nested.service.js"
export type { NestedResourceConfig } from "./service/nested.service.js"

// ─── Controller factory ──────────────────────────────────────────────────
export {
  OrgResourceController,
  RESOURCE_ROUTE_METHOD,
} from "./controller/resource.controller.js"
export type {
  OrgResourceControllerOptions,
  OrgResourceControllerBase,
  ResourceRoute,
  RouteOptions,
  RequestContext,
  ResourceServiceLike,
} from "./controller/resource.controller.js"

// ─── List cache ──────────────────────────────────────────────────────────
export {
  OrgListCache,
  defaultOrgListCache,
  ORG_LIST_CACHE_CONFIG,
} from "./cache/org-list-cache.js"
export type {
  OrgListCacheOptions,
  OrgListCacheConfig,
} from "./cache/org-list-cache.js"

// ─── Approval workflow ───────────────────────────────────────────────────
export {
  ApprovalRole,
  approvalOnCreate,
  approvalOnApprove,
  canSetApprovalStatus,
  buildApprovalStatusPatch,
  applyApprovalUpdate,
} from "./approval/approval.js"
export type {
  ApprovalStatusValue,
  ApprovalActor,
  ApprovalFields,
  ApprovalStatusPatch,
} from "./approval/approval.js"

// ─── Prisma errors ───────────────────────────────────────────────────────
export {
  isPrismaUnique,
  prismaUniqueFields,
  prismaUniqueIncludes,
  mapPrismaUnique,
  prismaUniqueError,
  prismaAdapterUniqueError,
} from "./prisma/unique.js"
export type { PrismaUniqueLike } from "./prisma/unique.js"

// ─── Deprecated 0.1 API (kept for backward compatibility) ────────────────
/** @deprecated use `OrgResourceService`. */
export { OrgCrudService } from "./legacy/crud.service.js"
export type { ListResult } from "./legacy/crud.service.js"
/** @deprecated use `OrgResourceController()`. */
export { OrgCrudController } from "./legacy/crud.controller.js"
/** @deprecated use `OrgResourceService` list / `planList`. */
export { findManyPaginated } from "./legacy/find-many-paginated.js"
/** @deprecated use `OrgResourceService` hooks + `approvalOnCreate` / `updateApproval`. */
export {
  mapApprovableCreate,
  runApprovalUpdate,
  withActor,
} from "./legacy/trade-approvable.js"
export {
  TradeListQueryDto,
  CreateTradeLineItemDto,
  UpdateApprovalDto,
} from "./legacy/trade-dto.js"
