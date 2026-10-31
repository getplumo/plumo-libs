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
function isBlank(v) {
  return v === void 0 || v === null || v === "";
}
function parseDate(value, label) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${label}: invalid date "${String(value)}"`);
  }
  return d;
}
function coerceFilterValue(value, type, label) {
  if (!type) return value;
  if (Array.isArray(value)) {
    throw new BadRequestException(`${label}: expected a single value`);
  }
  switch (type) {
    case "string":
      return String(value);
    case "number":
    case "int": {
      const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : Number.NaN;
      if (!Number.isFinite(n) || type === "int" && !Number.isSafeInteger(n)) {
        throw new BadRequestException(
          `${label}: expected ${type === "int" ? "an integer" : "a number"}, got "${String(value)}"`
        );
      }
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const v = String(value).trim().toLowerCase();
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
      throw new BadRequestException(
        `${label}: expected a boolean (true/false), got "${String(value)}"`
      );
    }
    case "date":
      return parseDate(value, label);
    default:
      return value;
  }
}
function utcDayRange(from, to, label) {
  if (isBlank(from) && isBlank(to)) return void 0;
  const range = {};
  if (!isBlank(from)) {
    const d = parseDate(from, label);
    d.setUTCHours(0, 0, 0, 0);
    range.gte = d;
  }
  if (!isBlank(to)) {
    const d = parseDate(to, label);
    d.setUTCHours(23, 59, 59, 999);
    range.lte = d;
  }
  return range;
}
function exactOptions(keyOrOptions, type) {
  if (typeof keyOrOptions === "object") return keyOrOptions;
  return { key: keyOrOptions, type };
}
var Filter = {
  /**
   * `?brandId=3` when key is `brandId` → `{ brandId: 3 }`.
   * Accepts `exact()`, `exact('queryKey')`, `exact('queryKey', 'int')` or
   * `exact({ key?, type? })`. Without `type` the raw value is used (rely on a
   * transforming DTO); with `type` it is coerced and validated (400).
   */
  exact(keyOrOptions, type) {
    const opts = exactOptions(keyOrOptions, type);
    return {
      apply({ query, where, field }) {
        const key = opts.key ?? field;
        if (!key) return;
        const v = query[key];
        if (isBlank(v)) return;
        where[field ?? key] = coerceFilterValue(v, opts.type, key);
      }
    };
  },
  /**
   * `?minPrice=&maxPrice=` → `{ [field]: { gte, lte } }`. Values are always
   * coerced to numbers; a non-numeric value or min > max → 400.
   */
  numberRange(minKey, maxKey, options = {}) {
    const type = options.type ?? "number";
    return {
      apply({ query, where, field }) {
        if (!field) return;
        const rawMin = query[minKey];
        const rawMax = query[maxKey];
        if (isBlank(rawMin) && isBlank(rawMax)) return;
        const min = isBlank(rawMin) ? void 0 : coerceFilterValue(rawMin, type, minKey);
        const max = isBlank(rawMax) ? void 0 : coerceFilterValue(rawMax, type, maxKey);
        if (min !== void 0 && max !== void 0 && min > max) {
          throw new BadRequestException(
            `${field}: min must be less than or equal to max`
          );
        }
        where[field] = {
          ...min !== void 0 && { gte: min },
          ...max !== void 0 && { lte: max }
        };
      }
    };
  },
  /** `?createdAtFrom=&createdAtTo=` → UTC day bounds. Invalid date → 400. */
  dateRange(fromKey, toKey) {
    return {
      apply({ query, where, field }) {
        if (!field) return;
        const range = utcDayRange(query[fromKey], query[toKey], field);
        if (range) where[field] = range;
      }
    };
  },
  /**
   * `?status=a,b` or array → `{ [field]: { in: [...] } }`.
   * Accepts `inList()`, `inList('queryKey')`, `inList('queryKey', 'int')` or
   * `inList({ key?, type? })`; with `type` every item is coerced (400).
   */
  inList(keyOrOptions, type) {
    const opts = exactOptions(keyOrOptions, type);
    return {
      apply({ query, where, field }) {
        const key = opts.key ?? field;
        if (!key || !field) return;
        const v = query[key];
        if (isBlank(v)) return;
        const list = (Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean)).map((item) => coerceFilterValue(item, opts.type, key));
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
function applySearch(where, fields, q, insensitive = true) {
  const search = typeof q === "string" ? q.trim() : "";
  if (!search || fields.length === 0) return;
  where.OR = fields.map(
    (field) => nestPath(
      field,
      insensitive ? { contains: search, mode: "insensitive" } : { contains: search }
    )
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
  /**
   * `?q=` (or `?{param}=`) → OR of `contains` (case-insensitive by default;
   * `insensitive: false` drops Prisma's Postgres-only `mode`).
   */
  search(fields, param = "q", insensitive = true) {
    return ({ query, where }) => {
      applySearch(where, fields, query[param] ?? query.q, insensitive);
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
    out.push(
      QueryStrategies.search(
        resource.search,
        resource.searchParam ?? "q",
        resource.searchCaseInsensitive !== false
      )
    );
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
function prismaUniqueColumns(error) {
  if (!isPrismaUnique(error)) return [];
  const meta = error.meta ?? {};
  const out = [];
  if (Array.isArray(meta.target)) out.push(...meta.target.map(unquote));
  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (constraint && typeof constraint === "object" && Array.isArray(constraint.fields)) {
    out.push(...constraint.fields.map(unquote));
  }
  return [...new Set(out.filter(Boolean))];
}
function prismaUniqueConstraints(error) {
  if (!isPrismaUnique(error)) return [];
  const meta = error.meta ?? {};
  const out = [];
  if (typeof meta.target === "string") out.push(unquote(meta.target));
  const cause = meta.driverAdapterError?.cause;
  const constraint = cause?.constraint;
  if (typeof constraint === "string") out.push(unquote(constraint));
  else if (constraint && typeof constraint.index === "string") {
    out.push(unquote(constraint.index));
  }
  const message = cause?.originalMessage;
  if (typeof message === "string") {
    const match = /constraint "([^"]+)"/.exec(message);
    if (match?.[1]) out.push(match[1]);
  }
  return [...new Set(out.filter(Boolean))];
}
function prismaUniqueFields(error) {
  return [
    .../* @__PURE__ */ new Set([...prismaUniqueColumns(error), ...prismaUniqueConstraints(error)])
  ];
}
function matchableColumns(error) {
  const columns = prismaUniqueColumns(error);
  if (columns.length) return new Set(columns);
  return new Set(prismaUniqueConstraints(error).flatMap((c) => c.split("_")));
}
function keyColumns(key) {
  return key.split(",").map((k) => k.trim()).filter(Boolean);
}
function prismaUniqueMatches(error, key) {
  if (!isPrismaUnique(error)) return false;
  const k = key.trim();
  if (!k) return false;
  if (prismaUniqueConstraints(error).includes(k)) return true;
  const wanted = keyColumns(k);
  if (!wanted.length) return false;
  const columns = matchableColumns(error);
  return wanted.every((c) => columns.has(c));
}
function prismaUniqueIncludes(error, field) {
  return prismaUniqueMatches(error, field);
}
function conflict(message, fields) {
  const body = {
    statusCode: 409,
    message,
    error: "Conflict",
    fields: fields.filter((f) => f !== "orgId")
  };
  return new ConflictException(body);
}
function mapPrismaUnique(error, messages, fallback = "Unique constraint violation") {
  if (!isPrismaUnique(error)) return;
  const columns = prismaUniqueColumns(error);
  for (const [key, message] of Object.entries(messages)) {
    if (prismaUniqueMatches(error, key)) {
      const isConstraintKey = prismaUniqueConstraints(error).includes(key.trim());
      throw conflict(
        message,
        columns.length ? columns : isConstraintKey ? [] : keyColumns(key)
      );
    }
  }
  throw conflict(fallback, columns);
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
  coerceFilterValue,
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
  prismaUniqueColumns,
  prismaUniqueConstraints,
  prismaUniqueFields,
  prismaUniqueMatches,
  prismaUniqueIncludes,
  mapPrismaUnique,
  prismaUniqueError,
  prismaAdapterUniqueError
};
