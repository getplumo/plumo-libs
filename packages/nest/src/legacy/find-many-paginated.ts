import {
  paginatedResult,
  resolvePagination,
  type PaginatedResult,
} from "../query/pagination.js"
import type { ModelDelegate, OrgRow } from "../core/types.js"

/**
 * Low-level paginated findMany + count (for services that skip OrgCrudService).
 *
 * @deprecated Use `OrgResourceService` or `planList`.
 */
export async function findManyPaginated(
  delegate: ModelDelegate,
  args: {
    where?: Record<string, unknown>
    orderBy?: unknown
    include?: unknown
    select?: unknown
    page?: number
    limit?: number
  },
): Promise<PaginatedResult<OrgRow>> {
  const { page, limit, skip } = resolvePagination(args)
  const where = args.where ?? {}
  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: args.orderBy,
      skip,
      take: limit,
      include: args.include,
      select: args.select,
    }),
    delegate.count({ where }),
  ])
  return paginatedResult(data, total, page, limit)
}
