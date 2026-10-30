// Decorator metadata polyfill: dist reads Reflect.getMetadata at import time.
import "reflect-metadata"

export {
  PaginationQueryDto,
  SortQueryDto,
  resolvePagination,
  paginatedResult,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "./pagination.js"
export type { PaginatedResult, PaginationMeta } from "./pagination.js"

export { Filter, applySearch } from "./filters.js"
export type { FilterBackend, FilterContext, WhereClause } from "./filters.js"

export {
  defineResource,
  buildWhereFromQuery,
  resolveOrder,
} from "./resource.js"
export type {
  ResourceConfig,
  DefinedResource,
  ListCacheConfig,
  OrderBy,
} from "./resource.js"

export { findManyPaginated } from "./find-many-paginated.js"

export type {
  OrgRow,
  ModelDelegate,
  DelegateHost,
} from "./prisma-delegate.js"

export {
  requireInOrg,
  requireRelatedInOrg,
  requireAllRelatedInOrg,
  requireInOrgModel,
} from "./require-in-org.js"
export type { OrgScopedDelegate } from "./require-in-org.js"

export { OrgCrudService } from "./crud.service.js"
export type { ListResult } from "./crud.service.js"
export { OrgCrudController } from "./crud.controller.js"

export {
  OrgListCache,
  defaultOrgListCache,
  ORG_LIST_CACHE_CONFIG,
} from "./org-list-cache.js"
export type {
  OrgListCacheOptions,
  OrgListCacheConfig,
} from "./org-list-cache.js"

export {
  ApprovalRole,
  approvalOnCreate,
  approvalOnApprove,
  canSetApprovalStatus,
  buildApprovalStatusPatch,
  applyApprovalUpdate,
} from "./approval.js"
export type {
  ApprovalStatusValue,
  ApprovalActor,
  ApprovalFields,
  ApprovalStatusPatch,
} from "./approval.js"

export {
  mapApprovableCreate,
  runApprovalUpdate,
  withActor,
} from "./trade-approvable.js"

export { OrgNestedCrudService } from "./nested-crud.service.js"
export type { NestedResourceConfig } from "./nested-crud.service.js"

export {
  isPrismaUnique,
  prismaUniqueFields,
  prismaUniqueIncludes,
  mapPrismaUnique,
  prismaUniqueError,
  prismaAdapterUniqueError,
} from "./map-prisma-unique.js"
export type { PrismaUniqueLike } from "./map-prisma-unique.js"

export {
  TradeListQueryDto,
  CreateTradeLineItemDto,
  UpdateApprovalDto,
} from "./trade-dto.js"
