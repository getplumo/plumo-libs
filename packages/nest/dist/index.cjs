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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ApprovalRole: () => ApprovalRole,
  CreateTradeLineItemDto: () => CreateTradeLineItemDto,
  CurrentActor: () => CurrentActor,
  CurrentOrgId: () => CurrentOrgId,
  DEFAULT_LIMIT: () => DEFAULT_LIMIT,
  DEFAULT_PAGE: () => DEFAULT_PAGE,
  Filter: () => Filter,
  MAX_LIMIT: () => MAX_LIMIT,
  ORG_LIST_CACHE_CONFIG: () => ORG_LIST_CACHE_CONFIG,
  OrgCrudController: () => OrgCrudController,
  OrgCrudService: () => OrgCrudService,
  OrgListCache: () => OrgListCache,
  OrgNestedCrudService: () => OrgNestedCrudService,
  OrgResourceController: () => OrgResourceController,
  OrgResourceService: () => OrgResourceService,
  PaginationQueryDto: () => PaginationQueryDto,
  QueryStrategies: () => QueryStrategies,
  RESOURCE_ROUTE_METHOD: () => RESOURCE_ROUTE_METHOD,
  SortQueryDto: () => SortQueryDto,
  TradeListQueryDto: () => TradeListQueryDto,
  UpdateApprovalDto: () => UpdateApprovalDto,
  applyApprovalUpdate: () => applyApprovalUpdate,
  applySearch: () => applySearch,
  approvalOnApprove: () => approvalOnApprove,
  approvalOnCreate: () => approvalOnCreate,
  buildApprovalStatusPatch: () => buildApprovalStatusPatch,
  buildListWhere: () => buildListWhere,
  buildWhereFromQuery: () => buildWhereFromQuery,
  canSetApprovalStatus: () => canSetApprovalStatus,
  defaultOrgListCache: () => defaultOrgListCache,
  defineResource: () => defineResource,
  delegateOf: () => delegateOf,
  findManyPaginated: () => findManyPaginated,
  fromCents: () => fromCents,
  includeFor: () => includeFor,
  isPrismaUnique: () => isPrismaUnique,
  mapApprovableCreate: () => mapApprovableCreate,
  mapPrismaUnique: () => mapPrismaUnique,
  orgIdFromAuth: () => orgIdFromAuth,
  paginatedResult: () => paginatedResult,
  planList: () => planList,
  prismaAdapterUniqueError: () => prismaAdapterUniqueError,
  prismaUniqueError: () => prismaUniqueError,
  prismaUniqueFields: () => prismaUniqueFields,
  prismaUniqueIncludes: () => prismaUniqueIncludes,
  requireAllRelatedInOrg: () => requireAllRelatedInOrg,
  requireInOrg: () => requireInOrg,
  requireInOrgModel: () => requireInOrgModel,
  requireRelatedInOrg: () => requireRelatedInOrg,
  resolveOrder: () => resolveOrder2,
  resolvePagination: () => resolvePagination,
  runApprovalUpdate: () => runApprovalUpdate,
  sumMoney: () => sumMoney,
  toCents: () => toCents,
  toNumber: () => toNumber,
  withActor: () => withActor
});
module.exports = __toCommonJS(index_exports);
var import_reflect_metadata2 = require("reflect-metadata");

// src/core/types.ts
function delegateOf(host, model) {
  const d = host[model];
  if (!d || typeof d !== "object") {
    throw new Error(`No delegate for model "${model}"`);
  }
  return d;
}

// src/core/decimal.ts
function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(String(value));
}
function toCents(value) {
  return Math.round(toNumber(value) * 100);
}
function fromCents(cents) {
  return Math.round(cents) / 100;
}
function sumMoney(values) {
  let cents = 0;
  for (const v of values) cents += toCents(v);
  return fromCents(cents);
}

// src/query/filters.ts
var import_common = require("@nestjs/common");
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
    throw new import_common.BadRequestException(
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

// src/resource/resource.ts
var DEFAULT_INCLUDE_ON = {
  retrieve: true,
  create: true,
  update: true,
  destroy: false,
  approval: true
};
function defineResource(config) {
  return {
    ...config,
    notFoundMessage: config.notFoundMessage ?? `${config.model} not found`
  };
}
function includeFor(resource, action) {
  const r = resource;
  if (!r.include) return {};
  const on = { ...DEFAULT_INCLUDE_ON, ...r.includeOn };
  return on[action] ? { include: r.include } : {};
}
function buildWhereFromQuery(resource, orgId, query = {}) {
  return buildListWhere(resource, orgId, query);
}
function resolveOrder2(resource, query = {}) {
  return resolveOrder(resource, query);
}

// src/tenancy/require-in-org.ts
var import_common2 = require("@nestjs/common");
async function requireInOrg(delegate, orgId, id, message = "Not found") {
  const row = await delegate.findFirst({ where: { id, orgId } });
  if (!row) {
    throw new import_common2.NotFoundException(message);
  }
  return row;
}
var requireRelatedInOrg = requireInOrg;
async function requireAllRelatedInOrg(delegate, orgId, ids, message = "One or more related records not found") {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return [];
  if (!delegate.findMany) {
    const rows2 = [];
    for (const id of unique) {
      rows2.push(await requireInOrg(delegate, orgId, id, message));
    }
    return rows2;
  }
  const rows = await delegate.findMany({
    where: { orgId, id: { in: unique } }
  });
  if (rows.length !== unique.length) {
    throw new import_common2.NotFoundException(message);
  }
  return rows;
}
async function requireInOrgModel(delegate, orgId, id, message) {
  return requireInOrg(delegate, orgId, id, message);
}

// src/tenancy/decorators.ts
var import_common3 = require("@nestjs/common");
function authOf(ctx) {
  const req = ctx.switchToHttp().getRequest();
  if (!req.auth) {
    throw new import_common3.UnauthorizedException("Missing authentication context");
  }
  return req.auth;
}
function orgIdFromAuth(auth) {
  const orgId = auth?.orgId;
  if (typeof orgId === "string" && orgId.trim()) return orgId.trim();
  throw new import_common3.ForbiddenException("Active organization is required");
}
var CurrentOrgId = (0, import_common3.createParamDecorator)(
  (_, ctx) => orgIdFromAuth(authOf(ctx))
);
var CurrentActor = (0, import_common3.createParamDecorator)(
  (_, ctx) => {
    const auth = authOf(ctx);
    return { userId: auth.userId ?? "", orgRole: auth.orgRole ?? null };
  }
);

// src/service/org-resource.service.ts
var import_common7 = require("@nestjs/common");

// src/approval/approval.ts
var import_common4 = require("@nestjs/common");
var ApprovalRole = {
  ADMIN: "org:admin",
  MANAGER: "org:manager",
  POS: "org:pos"
};
function approvalOnCreate(actor) {
  const auto = actor.orgRole === ApprovalRole.ADMIN || actor.orgRole === ApprovalRole.MANAGER || actor.orgRole === ApprovalRole.POS;
  if (auto) {
    const now = /* @__PURE__ */ new Date();
    return {
      createdBy: actor.userId,
      approvedBy: actor.userId,
      approvedAt: now,
      approvalStatus: "approved"
    };
  }
  return {
    createdBy: actor.userId,
    approvedBy: null,
    approvedAt: null,
    approvalStatus: "pending"
  };
}
function approvalOnApprove(approverUserId) {
  return {
    approvedBy: approverUserId,
    approvedAt: /* @__PURE__ */ new Date(),
    approvalStatus: "approved"
  };
}
function canSetApprovalStatus(orgRole) {
  return orgRole === ApprovalRole.ADMIN || orgRole === ApprovalRole.MANAGER;
}
function buildApprovalStatusPatch(current, next, actor) {
  if (next === current) return null;
  if (!canSetApprovalStatus(actor.orgRole)) {
    throw new import_common4.ForbiddenException(
      "Only manager or admin can change approval status"
    );
  }
  if (next === "approved") {
    return approvalOnApprove(actor.userId);
  }
  if (next === "pending") {
    return {
      approvalStatus: "pending",
      approvedBy: null,
      approvedAt: null
    };
  }
  return {
    approvalStatus: "rejected",
    approvedBy: actor.userId,
    approvedAt: /* @__PURE__ */ new Date()
  };
}
async function applyApprovalUpdate(current, next, actor, update) {
  const patch = buildApprovalStatusPatch(current.approvalStatus, next, actor);
  if (!patch) return current;
  return update(patch);
}

// src/cache/org-list-cache.ts
var import_common5 = require("@nestjs/common");
var DEFAULT_TTL_MS = 5 * 60 * 1e3;
var MAX_ENTRIES = 500;
var ORG_LIST_CACHE_CONFIG = /* @__PURE__ */ Symbol("ORG_LIST_CACHE_CONFIG");
var OrgListCache = class {
  store = /* @__PURE__ */ new Map();
  /** scope → scopes whose cached lists embed it (e.g. categories → brands). */
  dependents = /* @__PURE__ */ new Map();
  defaultTtlMs;
  maxEntries;
  enabled;
  constructor(config = {}) {
    this.defaultTtlMs = config.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = config.maxEntries ?? MAX_ENTRIES;
    this.enabled = config.enabled ?? true;
  }
  /**
   * Declare that lists cached under `scope` embed rows of `dependsOn`
   * scopes, so invalidating any of those also clears `scope`.
   */
  registerDependencies(scope, dependsOn) {
    for (const parent of dependsOn) {
      const set = this.dependents.get(parent) ?? /* @__PURE__ */ new Set();
      set.add(scope);
      this.dependents.set(parent, set);
    }
  }
  async getOrSet(scope, orgId, variant, load, options = {}) {
    if (!this.enabled) return load();
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const key = this.key(scope, orgId, variant);
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      this.store.delete(key);
      this.store.set(key, hit);
      return hit.value;
    }
    const value = await load();
    this.set(key, value, ttlMs);
    return value;
  }
  /** Clears `scope` for `orgId`, plus every scope that depends on it. */
  invalidate(scope, orgId, seen = /* @__PURE__ */ new Set()) {
    if (seen.has(scope)) return;
    seen.add(scope);
    const prefix = `${scope}:${orgId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const dependent of this.dependents.get(scope) ?? []) {
      this.invalidate(dependent, orgId, seen);
    }
  }
  set(key, value, ttlMs) {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.evict();
  }
  evict() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === void 0) break;
      this.store.delete(oldest);
    }
  }
  key(scope, orgId, variant) {
    return `${scope}:${orgId}:${stableJson(variant)}`;
  }
};
OrgListCache = __decorateClass([
  (0, import_common5.Injectable)(),
  __decorateParam(0, (0, import_common5.Optional)()),
  __decorateParam(0, (0, import_common5.Inject)(ORG_LIST_CACHE_CONFIG))
], OrgListCache);
var defaultOrgListCache = new OrgListCache();
function stableJson(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value !== "object") return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  const entries = Object.entries(value).filter(([, v]) => v !== void 0).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  return JSON.stringify(Object.fromEntries(entries));
}

// src/prisma/unique.ts
var import_common6 = require("@nestjs/common");
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
      throw new import_common6.ConflictException(message);
    }
  }
  throw new import_common6.ConflictException(fallback);
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

// src/service/org-resource.service.ts
var OrgResourceService = class {
  constructor(db, resource, listCache = defaultOrgListCache) {
    this.db = db;
    this.resource = resource;
    this.listCache = listCache;
    const cfg = this.def.listCache;
    if (cfg?.dependsOn?.length) {
      listCache.registerDependencies(cfg.scope, cfg.dependsOn);
    }
  }
  db;
  resource;
  listCache;
  /** Resource definition with field names widened to string. */
  get def() {
    return this.resource;
  }
  /** Model delegate on the service client (or on `host`, e.g. a tx). */
  delegate(host = this.db) {
    return delegateOf(host, this.def.model);
  }
  // ---------------------------------------------------------------- reads
  async list(orgId, query = {}) {
    const load = () => this.def.listMode === "all" ? this.loadAll(orgId, query) : this.loadPage(orgId, query);
    const cfg = this.def.listCache;
    if (!cfg) return load();
    const variant = this.def.listMode === "all" && Object.keys(query).length === 0 ? "" : query;
    return this.listCache.getOrSet(
      cfg.scope,
      orgId,
      variant,
      load,
      { ttlMs: cfg.ttlMs }
    );
  }
  async retrieve(orgId, id) {
    const row = await this.findOrFail(orgId, id, "retrieve");
    return this.presentOne(row, { orgId, action: "retrieve" });
  }
  /**
   * Load `{ id, orgId }` (with the include configured for `action`) or throw
   * 404. Writes call this before opening the transaction.
   */
  async findOrFail(orgId, id, action = "retrieve", host = this.db) {
    const where = { id, orgId };
    if (this.def.softDelete) where[this.def.softDelete.field] = null;
    const row = await this.delegate(host).findFirst({
      where,
      ...includeFor(this.def, action)
    });
    if (!row) throw new import_common7.NotFoundException(this.def.notFoundMessage);
    return row;
  }
  /** Strategies for the list where. Tenancy is always applied after them. */
  queryStrategies() {
    return [
      ...strategiesFor(this.def),
      QueryStrategies.where(({ orgId, query }) => this.scope(orgId, query))
    ];
  }
  /** Prisma select/include for list rows. */
  listShape() {
    const r = this.def;
    if (r.listSelect) return { select: r.listSelect };
    const include = r.listInclude ?? r.include;
    return include ? { include } : {};
  }
  async loadAll(orgId, query) {
    const { where, orderBy } = planList(
      this.def,
      orgId,
      query,
      this.queryStrategies()
    );
    const rows = await this.delegate().findMany({
      where,
      orderBy,
      ...this.listShape()
    });
    return this.presentList(rows, { orgId, query });
  }
  async loadPage(orgId, query) {
    const { where, orderBy, page, limit, skip } = planList(
      this.def,
      orgId,
      query,
      this.queryStrategies()
    );
    const [rows, total] = await Promise.all([
      this.delegate().findMany({
        where,
        orderBy,
        ...this.listShape(),
        skip,
        take: limit
      }),
      this.delegate().count({ where })
    ]);
    const data = await this.presentList(rows, { orgId, query });
    return paginatedResult(data, total, page, limit);
  }
  // --------------------------------------------------------------- writes
  async create(orgId, dto, actor) {
    const row = await this.runWrite(
      "create",
      orgId,
      actor,
      {},
      async (ctx) => {
        await this.checkRelations("create", orgId, dto, hostOf(ctx));
        const data = stripKeys(await this.beforeCreate(dto, ctx));
        return this.delegate(hostOf(ctx)).create({
          data: { ...data, orgId },
          ...includeFor(this.def, "create")
        });
      },
      (row2, ctx) => this.afterCreate(row2, ctx)
    );
    return this.presentOne(row, { orgId, action: "create" });
  }
  async update(orgId, id, dto, actor) {
    const existing = await this.findOrFail(orgId, id, "update");
    const row = await this.runWrite(
      "update",
      orgId,
      actor,
      { id, existing },
      async (ctx) => {
        await this.checkRelations("update", orgId, dto, hostOf(ctx));
        const data = stripKeys(await this.beforeUpdate(dto, ctx));
        return this.delegate(hostOf(ctx)).update({
          where: { id, orgId },
          data,
          ...includeFor(this.def, "update")
        });
      },
      (row2, ctx) => this.afterUpdate(row2, ctx)
    );
    return this.presentOne(row, { orgId, action: "update" });
  }
  /** Returns the deleted row (not presented), like 0.1. */
  async destroy(orgId, id, actor) {
    const existing = await this.findOrFail(orgId, id, "destroy");
    return this.runWrite(
      "destroy",
      orgId,
      actor,
      { id, existing },
      async (ctx) => {
        await this.beforeDestroy(ctx);
        const soft = this.def.softDelete;
        const delegate = this.delegate(hostOf(ctx));
        const include = includeFor(this.def, "destroy");
        return soft ? delegate.update({
          where: { id, orgId },
          data: { [soft.field]: /* @__PURE__ */ new Date() },
          ...include
        }) : delegate.delete({ where: { id, orgId }, ...include });
      },
      (row, ctx) => this.afterDestroy(row, ctx)
    );
  }
  /**
   * Approval workflow (`PATCH :id/approval`). Unchanged status → returns the
   * current row (no write). Otherwise checks the actor role (403), runs
   * `beforeApproval`, writes the patch and `afterApproval`.
   */
  async updateApproval(orgId, id, dto, actor) {
    const existing = await this.findOrFail(orgId, id, "approval");
    const from = String(
      existing.approvalStatus
    );
    const to = dto.approvalStatus;
    const patch = buildApprovalStatusPatch(from, to, actor);
    if (!patch) return this.presentOne(existing, { orgId, action: "approval" });
    const row = await this.runWrite(
      "approval",
      orgId,
      actor,
      { id, existing, change: { from, to, patch } },
      async (ctx) => {
        await this.beforeApproval(ctx);
        return this.delegate(hostOf(ctx)).update({
          where: { id, orgId },
          data: patch,
          ...includeFor(this.def, "approval")
        });
      },
      (row2, ctx) => this.afterApproval(row2, ctx)
    );
    return this.presentOne(row, { orgId, action: "approval" });
  }
  /**
   * Shared write runner: builds the context, opens the transaction when the
   * resource is transactional, runs `afterWrite` callbacks + the after hook,
   * maps unique errors and invalidates the list cache on success.
   */
  async runWrite(action, orgId, actor, extra, write, after) {
    const exec = async (tx) => {
      const callbacks = [];
      const ctx = {
        ...extra,
        action,
        orgId,
        actor,
        tx,
        afterWrite: (fn) => {
          callbacks.push(fn);
        }
      };
      const row = await write(ctx);
      for (const fn of callbacks) await fn(row);
      await after(row, ctx);
      return row;
    };
    try {
      const row = this.def.transactional ? await this.db.$transaction(
        (tx) => exec(tx)
      ) : await exec(this.db);
      this.invalidateListCache(orgId);
      return row;
    } catch (error) {
      this.mapWriteError(error, action);
      throw error;
    }
  }
  /** P2002 → 409 per `resource.unique` (only for the configured actions). */
  mapWriteError(error, action) {
    const unique = this.def.unique;
    if (!unique) return;
    const on = unique.on ?? ["create", "update"];
    if (!on.includes(action)) return;
    mapPrismaUnique(
      error,
      unique.messages ?? {},
      unique.fallback ?? "Unique constraint violation"
    );
  }
  /** Declarative FK membership checks (`resource.relations`). */
  async checkRelations(action, orgId, dto, host) {
    const rules = this.def.relations;
    if (!rules) return;
    const data = dto ?? {};
    for (const [key, rule] of Object.entries(rules)) {
      if (rule.on && !rule.on.includes(action)) continue;
      const value = data[key];
      const due = rule.required ? action === "create" || value !== void 0 : value != null;
      if (!due) continue;
      if (value == null) throw new import_common7.NotFoundException(rule.message);
      await requireInOrg(
        delegateOf(host, rule.model),
        orgId,
        Number(value),
        rule.message
      );
    }
  }
  invalidateListCache(orgId) {
    const cfg = this.def.listCache;
    if (cfg) this.listCache.invalidate(cfg.scope, orgId);
  }
  // ---------------------------------------------------------------- hooks
  /** Extra list where for this service. AND-merged; cannot change orgId. */
  scope(_orgId, _query) {
    return {};
  }
  presentList(rows, _ctx) {
    return rows;
  }
  presentOne(row, _ctx) {
    return row;
  }
  /** Map the create DTO to Prisma data (`orgId` is added by the service). */
  beforeCreate(dto, _ctx) {
    return { ...dto };
  }
  afterCreate(_row, _ctx) {
  }
  /** Map the update DTO to Prisma data. `ctx.existing` is the current row. */
  beforeUpdate(dto, _ctx) {
    return { ...dto };
  }
  afterUpdate(_row, _ctx) {
  }
  beforeDestroy(_ctx) {
  }
  afterDestroy(_row, _ctx) {
  }
  beforeApproval(_ctx) {
  }
  afterApproval(_row, _ctx) {
  }
};
function stripKeys(data) {
  const { orgId: _orgId, id: _id, ...rest } = data ?? {};
  return rest;
}
function hostOf(ctx) {
  return ctx.tx;
}

// src/service/nested.service.ts
var import_common8 = require("@nestjs/common");
var OrgNestedCrudService = class {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }
  db;
  config;
  get parentDelegate() {
    return this.delegate(this.config.parentModel);
  }
  get childDelegate() {
    return this.delegate(this.config.childModel);
  }
  delegate(model) {
    const d = this.db[model];
    if (!d || typeof d !== "object") {
      throw new Error(`No delegate for model "${model}"`);
    }
    return d;
  }
  async requireParent(orgId, parentId) {
    return requireInOrg(
      this.parentDelegate,
      orgId,
      parentId,
      this.config.parentNotFound ?? `${this.config.parentModel} not found`
    );
  }
  async requireChild(orgId, parentId, childId) {
    const row = await this.childDelegate.findFirst({
      where: {
        id: childId,
        orgId,
        [this.config.parentFk]: parentId
      }
    });
    if (!row) {
      throw new import_common8.NotFoundException(
        this.config.childNotFound ?? `${this.config.childModel} not found`
      );
    }
    return row;
  }
  async listChildren(orgId, parentId) {
    await this.requireParent(orgId, parentId);
    return this.childDelegate.findMany({
      where: { orgId, [this.config.parentFk]: parentId },
      orderBy: { createdAt: "asc" }
    });
  }
  async createChild(orgId, parentId, data) {
    await this.requireParent(orgId, parentId);
    return this.childDelegate.create({
      data: {
        ...data,
        orgId,
        [this.config.parentFk]: parentId
      }
    });
  }
  async updateChild(orgId, parentId, childId, data) {
    await this.requireChild(orgId, parentId, childId);
    return this.childDelegate.update({ where: { id: childId }, data });
  }
  async destroyChild(orgId, parentId, childId) {
    await this.requireChild(orgId, parentId, childId);
    return this.childDelegate.delete({ where: { id: childId } });
  }
};

// src/controller/resource.controller.ts
var import_reflect_metadata = require("reflect-metadata");
var import_common9 = require("@nestjs/common");
var RESOURCE_ROUTE_METHOD = {
  list: "findAll",
  retrieve: "findOne",
  create: "create",
  update: "update",
  destroy: "remove",
  approval: "updateApproval"
};
function OrgResourceController(options = {}) {
  class ResourceControllerBase {
  }
  const idParam = () => ({
    decorator: options.id === "number" ? (0, import_common9.Param)("id") : (0, import_common9.Param)("id", import_common9.ParseIntPipe),
    type: Number
  });
  const toId = (id) => options.id === "number" ? +id : id;
  const org = { decorator: CurrentOrgId(), type: String };
  const actor = { decorator: CurrentActor(), type: Object };
  const before = (route, orgId, a) => options.onRequest?.({ route, orgId, actor: a });
  const specs = [
    {
      route: "create",
      verb: import_common9.Post,
      params: [
        org,
        actor,
        { decorator: (0, import_common9.Body)(), type: options.create ?? Object }
      ],
      handler: function(orgId, a, dto) {
        before("create", orgId, a);
        return this.service.create(orgId, { ...dto }, a);
      }
    },
    {
      route: "list",
      verb: import_common9.Get,
      params: [
        org,
        actor,
        { decorator: (0, import_common9.Query)(), type: options.query ?? Object }
      ],
      handler: function(orgId, a, query) {
        before("list", orgId, a);
        const { orgId: _ignored, ...rest } = query ?? {};
        return this.service.list(orgId, rest);
      }
    },
    {
      route: "retrieve",
      verb: import_common9.Get,
      path: ":id",
      params: [org, actor, idParam()],
      handler: function(orgId, a, id) {
        before("retrieve", orgId, a);
        return this.service.retrieve(orgId, toId(id));
      }
    },
    {
      route: "approval",
      verb: import_common9.Patch,
      path: ":id/approval",
      params: [
        org,
        actor,
        idParam(),
        { decorator: (0, import_common9.Body)(), type: options.approval ?? Object }
      ],
      handler: function(orgId, a, id, dto) {
        before("approval", orgId, a);
        const svc = this.service;
        if (!svc.updateApproval) {
          throw new Error("service.updateApproval is not implemented");
        }
        return svc.updateApproval(orgId, toId(id), dto, a);
      }
    },
    {
      route: "update",
      verb: import_common9.Patch,
      path: ":id",
      params: [
        org,
        actor,
        idParam(),
        { decorator: (0, import_common9.Body)(), type: options.update ?? Object }
      ],
      handler: function(orgId, a, id, dto) {
        before("update", orgId, a);
        return this.service.update(orgId, toId(id), { ...dto }, a);
      }
    },
    {
      route: "destroy",
      verb: import_common9.Delete,
      path: ":id",
      params: [org, actor, idParam()],
      handler: function(orgId, a, id) {
        before("destroy", orgId, a);
        return this.service.destroy(orgId, toId(id), a);
      }
    }
  ];
  const proto = ResourceControllerBase.prototype;
  for (const spec of specs) {
    const setting = options.routes?.[spec.route];
    const enabled = spec.route === "approval" ? setting !== false && (setting !== void 0 || !!options.approval) : setting !== false;
    if (!enabled) continue;
    const key = RESOURCE_ROUTE_METHOD[spec.route];
    Object.defineProperty(proto, key, {
      value: spec.handler,
      writable: true,
      configurable: true,
      enumerable: false
    });
    Reflect.defineMetadata(
      "design:paramtypes",
      spec.params.map((p) => p.type),
      proto,
      key
    );
    spec.params.forEach((p, index) => p.decorator(proto, key, index));
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    const routeDecorators = [
      spec.verb(spec.path),
      ...options.decorators ?? [],
      ...typeof setting === "object" ? setting.decorators ?? [] : []
    ];
    for (const decorate of routeDecorators) {
      decorate(proto, key, descriptor);
    }
  }
  return ResourceControllerBase;
}

// src/legacy/crud.service.ts
var OrgCrudService = class {
  constructor(db, resource, listCache = defaultOrgListCache) {
    this.db = db;
    this.resource = resource;
    this.listCache = listCache;
    const cfg = resource.listCache;
    if (cfg?.dependsOn?.length) {
      listCache.registerDependencies(cfg.scope, cfg.dependsOn);
    }
  }
  db;
  resource;
  listCache;
  get delegate() {
    const d = this.db[this.resource.model];
    if (!d || typeof d !== "object") {
      throw new Error(`No delegate for model "${this.resource.model}"`);
    }
    return d;
  }
  get listMode() {
    return this.resource.listMode ?? "paginated";
  }
  /**
   * List rows for org.
   * - `listMode: 'paginated'` (default) → `{ data, pagination }`
   * - `listMode: 'all'` → full array (filters/search still apply; no skip/take)
   */
  async list(orgId, query = {}) {
    const load = () => this.listMode === "all" ? this.loadListAll(orgId, query) : this.loadListPage(orgId, query);
    const cfg = this.resource.listCache;
    if (!cfg) return load();
    const variant = this.listMode === "all" && Object.keys(query).length === 0 ? "" : query;
    return this.listCache.getOrSet(
      cfg.scope,
      orgId,
      variant,
      load,
      { ttlMs: cfg.ttlMs }
    );
  }
  buildListWhere(orgId, query) {
    return buildListWhere(
      this.resource,
      orgId,
      query,
      this.extraWhere(orgId, query)
    );
  }
  listFindArgs(where, orderBy) {
    return {
      where,
      orderBy,
      ...this.resource.listSelect ? { select: this.resource.listSelect } : this.resource.include ? { include: this.resource.include } : {}
    };
  }
  async loadListAll(orgId, query) {
    const where = this.buildListWhere(orgId, query);
    const orderBy = resolveOrder2(this.resource, query);
    const data = await this.delegate.findMany(
      this.listFindArgs(where, orderBy)
    );
    return data.map((row) => this.transformListItem(row));
  }
  async loadListPage(orgId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildListWhere(orgId, query);
    const orderBy = resolveOrder2(this.resource, query);
    const [data, total] = await Promise.all([
      this.delegate.findMany({
        ...this.listFindArgs(where, orderBy),
        skip,
        take: limit
      }),
      this.delegate.count({ where })
    ]);
    return paginatedResult(
      data.map((row) => this.transformListItem(row)),
      total,
      page,
      limit
    );
  }
  async retrieve(orgId, id) {
    const row = await requireInOrg(
      this.delegate,
      orgId,
      id,
      this.resource.notFoundMessage
    );
    return this.transformDetail(row);
  }
  /**
   * `data` is `any` and trailing args are open so domain services can use
   * concrete DTOs + ApprovalActor without TS2416.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(orgId, data, ..._extra) {
    const record = data;
    await this.assertCreate(orgId, record);
    const payload = await this.mapCreateData(orgId, record);
    const { id: _id, ...createData } = payload;
    const row = await this.delegate.create({
      data: { ...createData, orgId },
      ...this.resource.include ? { include: this.resource.include } : {}
    });
    this.invalidateListCache(orgId);
    return row;
  }
  async update(orgId, id, data, ..._extra) {
    const record = data;
    await this.retrieve(orgId, id);
    await this.assertUpdate(orgId, id, record);
    const payload = await this.mapUpdateData(orgId, id, record);
    const { orgId: _o, id: _i, ...updateData } = payload;
    const row = await this.delegate.update({
      where: { id, orgId },
      data: updateData,
      ...this.resource.include ? { include: this.resource.include } : {}
    });
    this.invalidateListCache(orgId);
    return row;
  }
  async destroy(orgId, id) {
    await this.retrieve(orgId, id);
    const row = await this.delegate.delete({ where: { id, orgId } });
    this.invalidateListCache(orgId);
    return row;
  }
  invalidateListCache(orgId) {
    const cfg = this.resource.listCache;
    if (cfg) this.listCache.invalidate(cfg.scope, orgId);
  }
  extraWhere(_orgId, _query) {
    return {};
  }
  transformListItem(row) {
    return row;
  }
  transformDetail(row) {
    return row;
  }
  async assertCreate(_orgId, _data) {
  }
  async assertUpdate(_orgId, _id, _data) {
  }
  async mapCreateData(_orgId, data) {
    return data;
  }
  async mapUpdateData(_orgId, _id, data) {
    return data;
  }
};

// src/legacy/crud.controller.ts
var import_common10 = require("@nestjs/common");
var OrgCrudController = class {
  resolveOrgId(req, _query = {}) {
    const fromAuth = req.auth?.orgId;
    if (typeof fromAuth === "string" && fromAuth.trim()) {
      return fromAuth.trim();
    }
    throw new import_common10.ForbiddenException("Active organization is required");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(req, body, query) {
    return this.service.create(
      this.resolveOrgId(req, query),
      body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findAll(req, query) {
    const q = query ?? {};
    const orgId = this.resolveOrgId(req, q);
    const { orgId: _, ...rest } = q;
    return this.service.list(orgId, rest);
  }
  findOne(req, id, query) {
    return this.service.retrieve(
      this.resolveOrgId(req, query),
      id
    );
  }
  update(req, id, body, query) {
    return this.service.update(
      this.resolveOrgId(req, query),
      id,
      body
    );
  }
  remove(req, id, query) {
    return this.service.destroy(
      this.resolveOrgId(req, query),
      id
    );
  }
};
__decorateClass([
  (0, import_common10.Post)(),
  __decorateParam(0, (0, import_common10.Req)()),
  __decorateParam(1, (0, import_common10.Body)()),
  __decorateParam(2, (0, import_common10.Query)())
], OrgCrudController.prototype, "create", 1);
__decorateClass([
  (0, import_common10.Get)(),
  __decorateParam(0, (0, import_common10.Req)()),
  __decorateParam(1, (0, import_common10.Query)())
], OrgCrudController.prototype, "findAll", 1);
__decorateClass([
  (0, import_common10.Get)(":id"),
  __decorateParam(0, (0, import_common10.Req)()),
  __decorateParam(1, (0, import_common10.Param)("id", import_common10.ParseIntPipe)),
  __decorateParam(2, (0, import_common10.Query)())
], OrgCrudController.prototype, "findOne", 1);
__decorateClass([
  (0, import_common10.Patch)(":id"),
  __decorateParam(0, (0, import_common10.Req)()),
  __decorateParam(1, (0, import_common10.Param)("id", import_common10.ParseIntPipe)),
  __decorateParam(2, (0, import_common10.Body)()),
  __decorateParam(3, (0, import_common10.Query)())
], OrgCrudController.prototype, "update", 1);
__decorateClass([
  (0, import_common10.Delete)(":id"),
  __decorateParam(0, (0, import_common10.Req)()),
  __decorateParam(1, (0, import_common10.Param)("id", import_common10.ParseIntPipe)),
  __decorateParam(2, (0, import_common10.Query)())
], OrgCrudController.prototype, "remove", 1);

// src/legacy/find-many-paginated.ts
async function findManyPaginated(delegate, args) {
  const { page, limit, skip } = resolvePagination(args);
  const where = args.where ?? {};
  const [data, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: args.orderBy,
      skip,
      take: limit,
      include: args.include,
      select: args.select
    }),
    delegate.count({ where })
  ]);
  return paginatedResult(data, total, page, limit);
}

// src/legacy/trade-approvable.ts
function mapApprovableCreate(data, extras) {
  const actor = data._actor ?? {
    userId: "system",
    orgRole: null
  };
  const { _actor, ...rest } = data;
  const amountField = extras.amountField ?? "totalAmount";
  return {
    ...rest,
    [extras.numberField]: `${extras.numberPrefix}-${String(extras.nextSeq).padStart(4, "0")}`,
    status: rest.status ?? "draft",
    ...rest[amountField] != null ? { [amountField]: rest[amountField] } : {},
    ...approvalOnCreate(actor)
  };
}
async function runApprovalUpdate(row, next, actor, update) {
  return applyApprovalUpdate(row, next, actor, async (patch) => {
    const updated = await update(patch);
    return updated;
  });
}
function withActor(data, actor) {
  return actor ? { ...data, _actor: actor } : data;
}

// src/legacy/trade-dto.ts
var import_class_transformer2 = require("class-transformer");
var import_class_validator2 = require("class-validator");
var TradeListQueryDto = class extends SortQueryDto {
  q;
  type;
  status;
  companyId;
  minTotalAmount;
  maxTotalAmount;
  createdAtFrom;
  createdAtTo;
  orgId;
};
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsString)()
], TradeListQueryDto.prototype, "q", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsIn)(["sell", "buy"])
], TradeListQueryDto.prototype, "type", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsString)()
], TradeListQueryDto.prototype, "status", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)()
], TradeListQueryDto.prototype, "companyId", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)()
], TradeListQueryDto.prototype, "minTotalAmount", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)()
], TradeListQueryDto.prototype, "maxTotalAmount", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsString)()
], TradeListQueryDto.prototype, "createdAtFrom", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsString)()
], TradeListQueryDto.prototype, "createdAtTo", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_validator2.IsString)()
], TradeListQueryDto.prototype, "orgId", 2);
var CreateTradeLineItemDto = class {
  productId;
  quantity;
  unitPrice;
  taxRatePercent;
};
__decorateClass([
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)()
], CreateTradeLineItemDto.prototype, "productId", 2);
__decorateClass([
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)(),
  (0, import_class_validator2.Min)(0)
], CreateTradeLineItemDto.prototype, "quantity", 2);
__decorateClass([
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)(),
  (0, import_class_validator2.Min)(0)
], CreateTradeLineItemDto.prototype, "unitPrice", 2);
__decorateClass([
  (0, import_class_validator2.IsOptional)(),
  (0, import_class_transformer2.Type)(() => Number),
  (0, import_class_validator2.IsNumber)(),
  (0, import_class_validator2.Min)(0)
], CreateTradeLineItemDto.prototype, "taxRatePercent", 2);
var UpdateApprovalDto = class {
  approvalStatus;
};
__decorateClass([
  (0, import_class_validator2.IsIn)(["pending", "approved", "rejected"])
], UpdateApprovalDto.prototype, "approvalStatus", 2);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ApprovalRole,
  CreateTradeLineItemDto,
  CurrentActor,
  CurrentOrgId,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  Filter,
  MAX_LIMIT,
  ORG_LIST_CACHE_CONFIG,
  OrgCrudController,
  OrgCrudService,
  OrgListCache,
  OrgNestedCrudService,
  OrgResourceController,
  OrgResourceService,
  PaginationQueryDto,
  QueryStrategies,
  RESOURCE_ROUTE_METHOD,
  SortQueryDto,
  TradeListQueryDto,
  UpdateApprovalDto,
  applyApprovalUpdate,
  applySearch,
  approvalOnApprove,
  approvalOnCreate,
  buildApprovalStatusPatch,
  buildListWhere,
  buildWhereFromQuery,
  canSetApprovalStatus,
  defaultOrgListCache,
  defineResource,
  delegateOf,
  findManyPaginated,
  fromCents,
  includeFor,
  isPrismaUnique,
  mapApprovableCreate,
  mapPrismaUnique,
  orgIdFromAuth,
  paginatedResult,
  planList,
  prismaAdapterUniqueError,
  prismaUniqueError,
  prismaUniqueFields,
  prismaUniqueIncludes,
  requireAllRelatedInOrg,
  requireInOrg,
  requireInOrgModel,
  requireRelatedInOrg,
  resolveOrder,
  resolvePagination,
  runApprovalUpdate,
  sumMoney,
  toCents,
  toNumber,
  withActor
});
