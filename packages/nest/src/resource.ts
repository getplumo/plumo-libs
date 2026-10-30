import { applySearch, type FilterBackend, type WhereClause } from "./filters.js"

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
  dependsOn?: string[]
}

export type ResourceConfig = {
  /** Logical model name (also key on PrismaService), e.g. 'product'. */
  model: string
  notFoundMessage?: string
  /** Fields matched by search query param (default `q`) */
  search?: string[]
  /** Query key for search (default `q`). Use `search` when API already exposes `?search=`. */
  searchParam?: string
  /** Map of prisma field → filter backend */
  filters?: Record<string, FilterBackend>
  sortable?: string[]
  /** Single field or Prisma-style multi-field orderBy. */
  defaultOrder?:
    | Record<string, "asc" | "desc">
    | Array<Record<string, "asc" | "desc">>
  /** Prisma include for retrieve (and optionally list). */
  include?: unknown
  /** Prisma select for list rows. */
  listSelect?: unknown
  /**
   * Opt-in org list cache. When set, list() is cached by query variant;
   * create/update/destroy invalidate the scope for that org.
   */
  listCache?: ListCacheConfig
  /**
   * `paginated` (default) → `{ data, pagination }`.
   * `all` → full `OrgRow[]` (no page/limit); typical for small cached catalogs.
   */
  listMode?: "paginated" | "all"
}

export type DefinedResource = ResourceConfig & {
  notFoundMessage: string
}

export function defineResource(config: ResourceConfig): DefinedResource {
  return {
    ...config,
    notFoundMessage: config.notFoundMessage ?? `${config.model} not found`,
  }
}

/** Always scopes by orgId — like DRF get_queryset().filter(org=…). */
export function buildWhereFromQuery(
  resource: DefinedResource,
  orgId: string,
  query: Record<string, unknown> = {},
): WhereClause {
  const where: WhereClause = { orgId }

  if (resource.search?.length) {
    const key = resource.searchParam ?? "q"
    applySearch(where, resource.search, query[key] ?? query.q)
  }

  for (const [field, backend] of Object.entries(resource.filters ?? {})) {
    backend.apply({ query, where, field })
  }

  return where
}

export type OrderBy =
  | Record<string, "asc" | "desc">
  | Array<Record<string, "asc" | "desc">>

export function resolveOrder(
  resource: DefinedResource,
  query: { sortBy?: string; sortDirection?: "asc" | "desc" } = {},
): OrderBy {
  const sortBy = query.sortBy
  const dir = query.sortDirection ?? "desc"
  if (sortBy && resource.sortable?.includes(sortBy)) {
    return { [sortBy]: dir }
  }
  return resource.defaultOrder ?? { createdAt: "desc" }
}
