import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator"

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedResult<T> = {
  data: T[]
  pagination: PaginationMeta
}

/** Mix into Find*QueryDto — same idea as DRF pagination query params. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT
}

export class SortQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sortBy?: string

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc"
}

export function resolvePagination(
  query: {
    page?: number
    limit?: number
  } = {},
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, query.page ?? DEFAULT_PAGE)
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT))
  return { page, limit, skip: (page - 1) * limit }
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}
