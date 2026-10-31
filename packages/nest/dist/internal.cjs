"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/internal.ts
var internal_exports = {};
__export(internal_exports, {
  createMockDelegate: () => createMockDelegate,
  delegateOf: () => delegateOf,
  prismaAdapterUniqueError: () => prismaAdapterUniqueError,
  prismaUniqueError: () => prismaUniqueError,
  recordNotFound: () => recordNotFound,
  resolveOrderRaw: () => resolveOrder,
  runStrategies: () => runStrategies,
  strategiesFor: () => strategiesFor
});
module.exports = __toCommonJS(internal_exports);
var import_reflect_metadata = require("reflect-metadata");

// src/query/filters.ts
var import_common = require("@nestjs/common");
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
var import_class_transformer = require("class-transformer");
var import_class_validator = require("class-validator");
var DEFAULT_PAGE = 1;
var DEFAULT_LIMIT = 20;
var MAX_LIMIT = 100;
var PaginationQueryDto = class {
  page = DEFAULT_PAGE;
  limit = DEFAULT_LIMIT;
};
__decorateClass([
  (0, import_class_validator.IsOptional)(),
  (0, import_class_transformer.Type)(() => Number),
  (0, import_class_validator.IsInt)(),
  (0, import_class_validator.Min)(1)
], PaginationQueryDto.prototype, "page", 2);
__decorateClass([
  (0, import_class_validator.IsOptional)(),
  (0, import_class_transformer.Type)(() => Number),
  (0, import_class_validator.IsInt)(),
  (0, import_class_validator.Min)(1),
  (0, import_class_validator.Max)(MAX_LIMIT)
], PaginationQueryDto.prototype, "limit", 2);
var SortQueryDto = class extends PaginationQueryDto {
  sortBy;
  sortDirection;
};
__decorateClass([
  (0, import_class_validator.IsOptional)(),
  (0, import_class_validator.IsString)()
], SortQueryDto.prototype, "sortBy", 2);
__decorateClass([
  (0, import_class_validator.IsOptional)(),
  (0, import_class_validator.IsIn)(["asc", "desc"])
], SortQueryDto.prototype, "sortDirection", 2);

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
function resolveOrder(resource, query = {}) {
  const sortBy = query.sortBy;
  const alias = resource.sortDirectionParam;
  const dir = query.sortDirection ?? (alias ? query[alias] : void 0) ?? "desc";
  if (typeof sortBy === "string" && resource.sortable?.includes(sortBy)) {
    return { [sortBy]: dir };
  }
  return resource.defaultOrder ?? { createdAt: "desc" };
}

// src/testing/mock-delegate.ts
function recordNotFound() {
  const err = new Error("Record to update not found.");
  err.code = "P2025";
  return err;
}
function createMockDelegate() {
  const rows = [];
  let seq = 1;
  function match(row, where) {
    for (const [key, condition] of Object.entries(where)) {
      if (key === "AND" && Array.isArray(condition)) {
        if (!condition.every((c) => match(row, c))) {
          return false;
        }
        continue;
      }
      if (key === "OR" && Array.isArray(condition)) {
        if (!condition.some((c) => match(row, c))) {
          return false;
        }
        continue;
      }
      if (condition === null) {
        if (row[key] != null) return false;
        continue;
      }
      if (condition && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof Date)) {
        const c = condition;
        if ("in" in c && Array.isArray(c.in)) {
          if (!c.in.includes(row[key])) return false;
          continue;
        }
        if ("contains" in c) {
          if (!String(row[key] ?? "").toLowerCase().includes(String(c.contains).toLowerCase())) {
            return false;
          }
          continue;
        }
        if ("gte" in c || "lte" in c) {
          const num = Number(row[key]);
          if (c.gte !== void 0 && !(num >= Number(c.gte))) return false;
          if (c.lte !== void 0 && !(num <= Number(c.lte))) return false;
          continue;
        }
      }
      if (row[key] !== condition) return false;
    }
    return true;
  }
  const delegate = {
    rows,
    async findFirst({ where }) {
      return rows.find((r) => match(r, where)) ?? null;
    },
    async findMany({ where, skip = 0, take }) {
      let list = rows.filter((r) => match(r, where ?? {}));
      list = list.slice(skip, take !== void 0 ? skip + take : void 0);
      return list;
    },
    async count({ where }) {
      return rows.filter((r) => match(r, where ?? {})).length;
    },
    async create({ data }) {
      const row = {
        id: seq++,
        createdAt: /* @__PURE__ */ new Date(),
        ...data
      };
      rows.push(row);
      return row;
    },
    async update({ where, data }) {
      const row = rows.find((r) => match(r, where));
      if (!row) throw recordNotFound();
      Object.assign(row, data);
      return row;
    },
    async delete({ where }) {
      const idx = rows.findIndex((r) => match(r, where));
      if (idx < 0) throw recordNotFound();
      const [row] = rows.splice(idx, 1);
      return row;
    }
  };
  return delegate;
}

// src/prisma/unique.ts
var import_common2 = require("@nestjs/common");
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

// src/core/types.ts
function delegateOf(host, model) {
  const d = host[model];
  if (!d || typeof d !== "object") {
    throw new Error(`No delegate for model "${model}"`);
  }
  return d;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createMockDelegate,
  delegateOf,
  prismaAdapterUniqueError,
  prismaUniqueError,
  recordNotFound,
  resolveOrderRaw,
  runStrategies,
  strategiesFor
});
