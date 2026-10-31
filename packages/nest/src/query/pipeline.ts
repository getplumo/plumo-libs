import type { OrderBy, SortDirection, WhereClause } from "../core/types.js"
import type { DefinedResource } from "../resource/resource.js"
import { applySearch, type FilterBackend } from "./filters.js"
import { resolvePagination } from "./pagination.js"

/** Raw list query (validated DTO or plain record). */
export type ListQuery = Record<string, unknown>

export type QueryContext = {
  orgId: string
  query: ListQuery
  /** Mutable where being built. Tenancy is added after every strategy. */
  where: WhereClause
}

/** One composable step of the list query pipeline. */
export type QueryStrategy = (ctx: QueryContext) => void

/** Merge `extra` into an AND list (never overwrites keys already built). */
function andMerge(where: WhereClause, extra: WhereClause): void {
  if (!extra || Object.keys(extra).length === 0) return
  const prev = Array.isArray(where.AND) ? (where.AND as WhereClause[]) : []
  where.AND = [...prev, extra]
}

/** Built-in strategies. Services can add their own via `queryStrategies()`. */
export const QueryStrategies = {
  /**
   * `?q=` (or `?{param}=`) → OR of `contains` (case-insensitive by default;
   * `insensitive: false` drops Prisma's Postgres-only `mode`).
   */
  search(fields: readonly string[], param = "q", insensitive = true): QueryStrategy {
    return ({ query, where }) => {
      applySearch(where, fields, query[param] ?? query.q, insensitive)
    }
  },

  /** Declarative filter backends keyed by prisma field. */
  filters(map: Partial<Record<string, FilterBackend>>): QueryStrategy {
    return ({ query, where }) => {
      for (const [field, backend] of Object.entries(map)) {
        backend?.apply({ query, where, field })
      }
    }
  },

  /** Hide soft-deleted rows. */
  softDelete(field: string): QueryStrategy {
    return ({ where }) => {
      where[field] = null
    }
  },

  /** Extra where (service scope). AND-merged, so it cannot widen the query. */
  where(extra: WhereClause | ((ctx: QueryContext) => WhereClause)): QueryStrategy {
    return (ctx) => {
      andMerge(ctx.where, typeof extra === "function" ? extra(ctx) : extra)
    }
  },
} as const

/** Default strategies derived from a resource definition. */
export function strategiesFor(resource: DefinedResource): QueryStrategy[] {
  const out: QueryStrategy[] = []
  if (resource.search?.length) {
    out.push(
      QueryStrategies.search(
        resource.search,
        resource.searchParam ?? "q",
        resource.searchCaseInsensitive !== false,
      ),
    )
  }
  if (resource.filters) {
    out.push(
      QueryStrategies.filters(
        resource.filters as Partial<Record<string, FilterBackend>>,
      ),
    )
  }
  if (resource.softDelete) {
    out.push(QueryStrategies.softDelete(resource.softDelete.field))
  }
  return out
}

/**
 * Run strategies, then apply tenancy LAST: `orgId` always comes from the
 * caller (token), whatever a strategy or scope wrote.
 */
export function runStrategies(
  strategies: readonly QueryStrategy[],
  orgId: string,
  query: ListQuery = {},
): WhereClause {
  const ctx: QueryContext = { orgId, query, where: {} }
  for (const s of strategies) s(ctx)
  ctx.where.orgId = orgId
  return ctx.where
}

/** where for a resource list (+ optional service scope). */
export function buildListWhere(
  resource: DefinedResource,
  orgId: string,
  query: ListQuery = {},
  scope?: WhereClause,
): WhereClause {
  const strategies = strategiesFor(resource)
  if (scope) strategies.push(QueryStrategies.where(scope))
  return runStrategies(strategies, orgId, query)
}

/**
 * `?sortBy=` must be in `sortable`; direction is `sortDirection` (or the
 * resource's legacy alias, e.g. `sortOrder`), default `desc`.
 * Otherwise `defaultOrder`, else `{ createdAt: 'desc' }`.
 */
export function resolveOrder(
  resource: DefinedResource,
  query: ListQuery = {},
): OrderBy {
  const sortBy = query.sortBy
  const alias = resource.sortDirectionParam
  const dir = (query.sortDirection ??
    (alias ? query[alias] : undefined) ??
    "desc") as SortDirection
  if (
    typeof sortBy === "string" &&
    (resource.sortable as readonly string[] | undefined)?.includes(sortBy)
  ) {
    return { [sortBy]: dir }
  }
  return resource.defaultOrder ?? { createdAt: "desc" }
}

export type ListPlan = {
  where: WhereClause
  orderBy: OrderBy
  page: number
  limit: number
  skip: number
}

/** Full plan for a paginated list (where + order + page window). */
export function planList(
  resource: DefinedResource,
  orgId: string,
  query: ListQuery = {},
  strategies: readonly QueryStrategy[] = strategiesFor(resource),
): ListPlan {
  const where = runStrategies(strategies, orgId, query)
  const orderBy = resolveOrder(resource, query)
  const { page, limit, skip } = resolvePagination(
    query as { page?: number; limit?: number },
  )
  return { where, orderBy, page, limit, skip }
}
