var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/core/types.ts
function delegateOf(host, model) {
  const d = host[model];
  if (!d || typeof d !== "object") {
    throw new Error(`No delegate for model "${model}"`);
  }
  return d;
}

// src/query/filters.ts
import { BadRequestException } from "@nestjs/common";
function utcDayRange(from, to) {
  if (!from && !to) return void 0;
  const range = {};
  if (from) {
    const d = new Date(String(from));
    d.setUTCHours(0, 0, 0, 0);
    range.gte = d;
  }
  if (to) {
    const d = new Date(String(to));
    d.setUTCHours(23, 59, 59, 999);
    range.lte = d;
  }
  return range;
}
function assertRange(min, max, label) {
  if (min !== void 0 && max !== void 0 && Number(min) > Number(max)) {
    throw new BadRequestException(
      `${label}: min must be less than or equal to max`
    );
  }
}
var Filter = {
  /** `?brandId=3` when key is `brandId` → `{ brandId: 3 }` */
  exact(queryKey) {
    return {
      apply({ query, where, field }) {
        const key = queryKey ?? field;
        if (!key) return;
        const v = query[key];
        if (v !== void 0 && v !== null && v !== "") {
          where[field ?? key] = v;
        }
      }
    };
  },
  /** `?minPrice=&maxPrice=` → `{ [field]: { gte, lte } }` */
  numberRange(minKey, maxKey) {
    return {
      apply({ query, where, field }) {
        if (!field) return;
        const min = query[minKey];
        const max = query[maxKey];
        if (min === void 0 && max === void 0) return;
        assertRange(min, max, field);
        where[field] = {
          ...min !== void 0 && min !== "" && { gte: Number(min) },
          ...max !== void 0 && max !== "" && { lte: Number(max) }
        };
      }
    };
  },
  /** `?createdAtFrom=&createdAtTo=` → UTC day bounds */
  dateRange(fromKey, toKey) {
    return {
      apply({ query, where, field }) {
        if (!field) return;
        const range = utcDayRange(
          query[fromKey],
          query[toKey]
        );
        if (range) where[field] = range;
      }
    };
  },
  /** `?status=a,b` or array → `{ [field]: { in: [...] } }` */
  inList(queryKey) {
    return {
      apply({ query, where, field }) {
        const key = queryKey ?? field;
        if (!key || !field) return;
        const v = query[key];
        if (v === void 0 || v === null || v === "") return;
        const list = Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);
        if (list.length) where[field] = { in: list };
      }
    };
  },
  custom(fn) {
    return { apply: fn };
  }
};
function nestPath(path, leaf) {
  return path.split(".").reduceRight((acc, key) => ({ [key]: acc }), leaf);
}
function applySearch(where, fields, q) {
  const search = typeof q === "string" ? q.trim() : "";
  if (!search || fields.length === 0) return;
  where.OR = fields.map(
    (field) => nestPath(field, { contains: search, mode: "insensitive" })
  );
}

// src/query/pagination.ts
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
var DEFAULT_PAGE = 1;
var DEFAULT_LIMIT = 20;
var MAX_LIMIT = 100;
var PaginationQueryDto = class {
  page = DEFAULT_PAGE;
  limit = DEFAULT_LIMIT;
};
__decorateClass([
  IsOptional(),
  Type(() => Number),
  IsInt(),
  Min(1)
], PaginationQueryDto.prototype, "page", 2);
__decorateClass([
  IsOptional(),
  Type(() => Number),
  IsInt(),
  Min(1),
  Max(MAX_LIMIT)
], PaginationQueryDto.prototype, "limit", 2);
var SortQueryDto = class extends PaginationQueryDto {
  sortBy;
  sortDirection;
};
__decorateClass([
  IsOptional(),
  IsString()
], SortQueryDto.prototype, "sortBy", 2);
__decorateClass([
  IsOptional(),
  IsIn(["asc", "desc"])
], SortQueryDto.prototype, "sortDirection", 2);
function resolvePagination(query = {}) {
  const page = Math.max(1, query.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}
function paginatedResult(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

// src/query/pipeline.ts
function andMerge(where, extra) {
  if (!extra || Object.keys(extra).length === 0) return;
  const prev = Array.isArray(where.AND) ? where.AND : [];
  where.AND = [...prev, extra];
}
var QueryStrategies = {
  /** `?q=` (or `?{param}=`) → OR of case-insensitive contains. */
  search(fields, param = "q") {
    return ({ query, where }) => {
      applySearch(where, fields, query[param] ?? query.q);
    };
  },
  /** Declarative filter backends keyed by prisma field. */
  filters(map) {
    return ({ query, where }) => {
      for (const [field, backend] of Object.entries(map)) {
        backend?.apply({ query, where, field });
      }
    };
  },
  /** Hide soft-deleted rows. */
  softDelete(field) {
    return ({ where }) => {
      where[field] = null;
    };
  },
  /** Extra where (service scope). AND-merged, so it cannot widen the query. */
  where(extra) {
    return (ctx) => {
      andMerge(ctx.where, typeof extra === "function" ? extra(ctx) : extra);
    };
  }
};
function strategiesFor(resource) {
  const out = [];
  if (resource.search?.length) {
    out.push(QueryStrategies.search(resource.search, resource.searchParam ?? "q"));
  }
  if (resource.filters) {
    out.push(
      QueryStrategies.filters(
        resource.filters
      )
    );
  }
  if (resource.softDelete) {
    out.push(QueryStrategies.softDelete(resource.softDelete.field));
  }
  return out;
}
function runStrategies(strategies, orgId, query = {}) {
  const ctx = { orgId, query, where: {} };
  for (const s of strategies) s(ctx);
  ctx.where.orgId = orgId;
  return ctx.where;
}
function buildListWhere(resource, orgId, query = {}, scope) {
  const strategies = strategiesFor(resource);
  if (scope) strategies.push(QueryStrategies.where(scope));
  return runStrategies(strategies, orgId, query);
}
function resolveOrder(resource, query = {}) {
  const sortBy = query.sortBy;
  const alias = resource.sortDirectionParam;
  const dir = query.sortDirection ?? (alias ? query[alias] : void 0) ?? "desc";
  if (typeof sortBy === "string" && resource.sortable?.includes(sortBy)) {
    return { [sortBy]: dir };
  }
  return resource.defaultOrder ?? { createdAt: "desc" };
}
function planList(resource, orgId, query = {}, strategies = strategiesFor(resource)) {
  const where = runStrategies(strategies, orgId, query);
  const orderBy = resolveOrder(resource, query);
  const { page, limit, skip } = resolvePagination(
    query
  );
  return { where, orderBy, page, limit, skip };
}

// src/prisma/unique.ts
import { ConflictException } from "@nestjs/common";
function isPrismaUnique(error) {
  return typeof error === "object" && error !== null && error.code === "P2002";
}
function unquote(value) {
  return String(value).trim().replace(/^"+|"+$/g, "");
}
function prismaUniqueFields(error) {
  if (!isPrismaUnique(error)) return [];
  const meta = error.meta ?? {};
  const out = [];
  const target = meta.target;
  if (Array.isArray(target)) out.push(...target.map(unquote));
  else if (typeof target === "string") out.push(unquote(target));
  const cause = meta.driverAdapterError?.cause;
  const constraint = cause?.constraint;
  if (typeof constraint === "string") {
    out.push(unquote(constraint));
  } else if (constraint) {
    if (Array.isArray(constraint.fields)) {
      out.push(...constraint.fields.map(unquote));
    }
    if (typeof constraint.index === "string") out.push(unquote(constraint.index));
  }
  const message = cause?.originalMessage;
  if (typeof message === "string") {
    const match = /constraint "([^"]+)"/.exec(message);
    if (match?.[1]) out.push(match[1]);
  }
  return [...new Set(out.filter(Boolean))];
}
function prismaUniqueIncludes(error, field) {
  return prismaUniqueFields(error).some(
    (f) => f === field || f.includes(field)
  );
}
function mapPrismaUnique(error, messages, fallback = "Unique constraint violation") {
  if (!isPrismaUnique(error)) return;
  const fields = prismaUniqueFields(error);
  for (const [key, message] of Object.entries(messages)) {
    if (fields.some((field) => field === key || field.includes(key))) {
      throw new ConflictException(message);
    }
  }
  throw new ConflictException(fallback);
}
function prismaUniqueError(fields) {
  const err = new Error(
    `Unique constraint failed on the fields: (${fields.join(", ")})`
  );
  err.code = "P2002";
  err.meta = { target: fields };
  return err;
}
function prismaAdapterUniqueError(fields, constraintName, modelName = "Model") {
  const err = new Error(
    "Unique constraint failed on the constraint: `" + constraintName + "`"
  );
  err.code = "P2002";
  err.meta = {
    modelName,
    driverAdapterError: {
      cause: {
        originalCode: "23505",
        originalMessage: `duplicate key value violates unique constraint "${constraintName}"`,
        kind: "UniqueConstraintViolation",
        constraint: { fields: fields.map((f) => `"${f}"`) }
      }
    }
  };
  return err;
}

export {
  __decorateClass,
  __decorateParam,
  delegateOf,
  Filter,
  applySearch,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  PaginationQueryDto,
  SortQueryDto,
  resolvePagination,
  paginatedResult,
  QueryStrategies,
  strategiesFor,
  runStrategies,
  buildListWhere,
  resolveOrder,
  planList,
  isPrismaUnique,
  prismaUniqueFields,
  prismaUniqueIncludes,
  mapPrismaUnique,
  prismaUniqueError,
  prismaAdapterUniqueError
};
