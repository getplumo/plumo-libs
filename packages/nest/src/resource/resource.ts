import type { FilterBackend } from "../query/filters.js"
import type { FieldOf, OrderBy, WhereClause } from "../core/types.js"
import {
  buildListWhere,
  resolveOrder as resolveOrderImpl,
} from "../query/pipeline.js"

export type { OrderBy }

export type ListCacheConfig = {
  /** Cache scope key, e.g. 'brands' — invalidate uses same scope. */
  scope: string
  /** Override default TTL (5 min). */
  ttlMs?: number
  /**
   * Scopes whose rows are embedded in this list (e.g. brands include
   * categories → `dependsOn: ['categories']`). A write that invalidates one
   * of them also invalidates this scope.
   */
  dependsOn?: readonly string[]
}

/** Field on the row, or a dotted relation path (`company.name`). */
export type SearchPath<TRow> = FieldOf<TRow> | `${string}.${string}`

/**
 * Declarative org-membership check for a foreign key in the create/update DTO.
 *
 * - `required: true` → checked on every create, and on update whenever the
 *   key is present (`!== undefined`).
 * - otherwise → checked only when the value is not null/undefined.
 *
 * Throws 404 `message` when `{ id, orgId }` does not exist in `model`.
 */
export type RelationRule = {
  model: string
  message: string
  required?: boolean
  /** Restrict to some write actions (default both). */
  on?: ReadonlyArray<"create" | "update">
}

/** Which writes/reads use `include` (detail shape). */
export type IncludeOn = {
  retrieve?: boolean
  create?: boolean
  update?: boolean
  destroy?: boolean
  approval?: boolean
}

export type UniqueConfig = {
  /**
   * Key → 409 message; first match wins. A key matches when it is exactly
   * one of the conflicting columns (`'code'`), a comma-separated set of
   * columns that all conflict (`'orgId,code'`), or the exact constraint /
   * index name (`'products_orgId_code_key'`). No substring matching:
   * `name` does not match `displayName`.
   */
  messages?: Record<string, string>
  /** 409 message when no key matches (default: generic). */
  fallback?: string
  /** Write actions mapped (default create + update). */
  on?: ReadonlyArray<"create" | "update">
}

export type SoftDeleteConfig = {
  /** Timestamp column set on destroy and filtered (null) on read. */
  field: string
}

/**
 * One declarative description of an org-scoped resource.
 * `TRow` (optional) types field names: `defineResource<Product>({...})`.
 */
export type ResourceDefinition<TRow extends object = Record<string, unknown>> = {
  /** Delegate name on PrismaService, e.g. 'product'. */
  model: string
  notFoundMessage?: string
  /** Fields matched by the search query param (default `q`). */
  search?: ReadonlyArray<SearchPath<TRow>>
  /** Query key for search (default `q`, `?q=` is always accepted too). */
  searchParam?: string
  /**
   * Case-insensitive search via Prisma `mode: "insensitive"` (default `true`,
   * PostgreSQL / MongoDB only). Set `false` on MySQL / SQLite / SQL Server,
   * where Prisma rejects `mode`; matching then follows the column collation.
   */
  searchCaseInsensitive?: boolean
  /** Map of query param → filter backend (keys may be relation ids or aliases). */
  filters?: Record<string, FilterBackend>
  /** Whitelist for `?sortBy=`. Anything else falls back to `defaultOrder`. */
  sortable?: ReadonlyArray<FieldOf<TRow>>
  /** Legacy alias accepted for `sortDirection` (e.g. `sortOrder`). */
  sortDirectionParam?: string
  defaultOrder?: OrderBy
  /** Prisma include for the detail shape (retrieve + writes, see includeOn). */
  include?: unknown
  /** Override when `include` is applied (default: all but destroy). */
  includeOn?: IncludeOn
  /** Prisma include for list rows (default: `include`). */
  listInclude?: unknown
  /** Prisma select for list rows (wins over listInclude). */
  listSelect?: unknown
  /** Opt-in org list cache (writes invalidate the scope). */
  listCache?: ListCacheConfig
  /** `paginated` (default) → `{ data, pagination }`; `all` → plain array. */
  listMode?: "paginated" | "all"
  /** Run writes (+ hooks) in one `$transaction`; hooks get `ctx.tx`. */
  transactional?: boolean
  /** Map Prisma P2002 to 409 with readable messages. */
  unique?: UniqueConfig
  /** Org-membership checks for FK fields in the DTOs. */
  relations?: Record<string, RelationRule>
  /** Soft delete instead of `delete`. */
  softDelete?: SoftDeleteConfig
}

export type DefinedResource<TRow extends object = Record<string, unknown>> =
  ResourceDefinition<TRow> & { notFoundMessage: string }

/** @deprecated use `ResourceDefinition`. */
export type ResourceConfig = ResourceDefinition

const DEFAULT_INCLUDE_ON: Required<IncludeOn> = {
  retrieve: true,
  create: true,
  update: true,
  destroy: false,
  approval: true,
}

export function defineResource<TRow extends object = Record<string, unknown>>(
  config: ResourceDefinition<TRow>,
): DefinedResource<TRow> {
  return {
    ...config,
    notFoundMessage: config.notFoundMessage ?? `${config.model} not found`,
  }
}

/** Include for an action, honouring `includeOn`. */
export function includeFor(
  resource: ResourceDefinition<never> | DefinedResource<never>,
  action: keyof IncludeOn,
): { include?: unknown } {
  const r = resource as ResourceDefinition
  if (!r.include) return {}
  const on = { ...DEFAULT_INCLUDE_ON, ...r.includeOn }
  return on[action] ? { include: r.include } : {}
}

/**
 * @deprecated use `buildListWhere` (query pipeline). Kept for callers of 0.1.
 * Always scopes by orgId.
 */
export function buildWhereFromQuery(
  resource: DefinedResource<never> | DefinedResource,
  orgId: string,
  query: Record<string, unknown> = {},
): WhereClause {
  return buildListWhere(resource as DefinedResource, orgId, query)
}

/** Resolve `?sortBy=&sortDirection=` against the whitelist. */
export function resolveOrder(
  resource: DefinedResource<never> | DefinedResource,
  query: Record<string, unknown> = {},
): OrderBy {
  return resolveOrderImpl(resource as DefinedResource, query)
}
