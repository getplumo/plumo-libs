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

// src/index.ts
import "reflect-metadata";

// src/pagination.ts
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

// src/filters.ts
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
function applySearch(where, fields, q) {
  const search = typeof q === "string" ? q.trim() : "";
  if (!search || fields.length === 0) return;
  where.OR = fields.map((field) => ({
    [field]: { contains: search, mode: "insensitive" }
  }));
}

// src/resource.ts
function defineResource(config) {
  return {
    ...config,
    notFoundMessage: config.notFoundMessage ?? `${config.model} not found`
  };
}
function buildWhereFromQuery(resource, orgId, query = {}) {
  const where = { orgId };
  if (resource.search?.length) {
    const key = resource.searchParam ?? "q";
    applySearch(where, resource.search, query[key] ?? query.q);
  }
  for (const [field, backend] of Object.entries(resource.filters ?? {})) {
    backend.apply({ query, where, field });
  }
  return where;
}
function resolveOrder(resource, query = {}) {
  const sortBy = query.sortBy;
  const dir = query.sortDirection ?? "desc";
  if (sortBy && resource.sortable?.includes(sortBy)) {
    return { [sortBy]: dir };
  }
  return resource.defaultOrder ?? { createdAt: "desc" };
}

// src/find-many-paginated.ts
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

// src/require-in-org.ts
import { NotFoundException } from "@nestjs/common";
async function requireInOrg(delegate, orgId, id, message = "Not found") {
  const row = await delegate.findFirst({ where: { id, orgId } });
  if (!row) {
    throw new NotFoundException(message);
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
    throw new NotFoundException(message);
  }
  return rows;
}
async function requireInOrgModel(delegate, orgId, id, message) {
  return requireInOrg(delegate, orgId, id, message);
}

// src/org-list-cache.ts
import { Inject, Injectable, Optional } from "@nestjs/common";
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
  Injectable(),
  __decorateParam(0, Optional()),
  __decorateParam(0, Inject(ORG_LIST_CACHE_CONFIG))
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

// src/crud.service.ts
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
    return {
      ...buildWhereFromQuery(this.resource, orgId, query),
      ...this.extraWhere(orgId, query)
    };
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
    const orderBy = resolveOrder(this.resource, query);
    const data = await this.delegate.findMany(
      this.listFindArgs(where, orderBy)
    );
    return data.map((row) => this.transformListItem(row));
  }
  async loadListPage(orgId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildListWhere(orgId, query);
    const orderBy = resolveOrder(this.resource, query);
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
    const row = await this.delegate.create({
      data: { ...payload, orgId },
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
    const row = await this.delegate.update({
      where: { id },
      data: payload,
      ...this.resource.include ? { include: this.resource.include } : {}
    });
    this.invalidateListCache(orgId);
    return row;
  }
  async destroy(orgId, id) {
    await this.retrieve(orgId, id);
    const row = await this.delegate.delete({ where: { id } });
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

// src/crud.controller.ts
import {
  Body,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  ForbiddenException
} from "@nestjs/common";
var OrgCrudController = class {
  resolveOrgId(req, _query = {}) {
    const fromAuth = req.auth?.orgId;
    if (typeof fromAuth === "string" && fromAuth.trim()) {
      return fromAuth.trim();
    }
    throw new ForbiddenException("Active organization is required");
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
  Post(),
  __decorateParam(0, Req()),
  __decorateParam(1, Body()),
  __decorateParam(2, Query())
], OrgCrudController.prototype, "create", 1);
__decorateClass([
  Get(),
  __decorateParam(0, Req()),
  __decorateParam(1, Query())
], OrgCrudController.prototype, "findAll", 1);
__decorateClass([
  Get(":id"),
  __decorateParam(0, Req()),
  __decorateParam(1, Param("id", ParseIntPipe)),
  __decorateParam(2, Query())
], OrgCrudController.prototype, "findOne", 1);
__decorateClass([
  Patch(":id"),
  __decorateParam(0, Req()),
  __decorateParam(1, Param("id", ParseIntPipe)),
  __decorateParam(2, Body()),
  __decorateParam(3, Query())
], OrgCrudController.prototype, "update", 1);
__decorateClass([
  Delete(":id"),
  __decorateParam(0, Req()),
  __decorateParam(1, Param("id", ParseIntPipe)),
  __decorateParam(2, Query())
], OrgCrudController.prototype, "remove", 1);

// src/approval.ts
import { ForbiddenException as ForbiddenException2 } from "@nestjs/common";
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
    throw new ForbiddenException2(
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

// src/trade-approvable.ts
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

// src/nested-crud.service.ts
import { NotFoundException as NotFoundException2 } from "@nestjs/common";
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
      throw new NotFoundException2(
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

// src/map-prisma-unique.ts
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

// src/trade-dto.ts
import { Type as Type2 } from "class-transformer";
import {
  IsIn as IsIn2,
  IsNumber,
  IsOptional as IsOptional2,
  IsString as IsString2,
  Min as Min2
} from "class-validator";
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
  IsOptional2(),
  IsString2()
], TradeListQueryDto.prototype, "q", 2);
__decorateClass([
  IsOptional2(),
  IsIn2(["sell", "buy"])
], TradeListQueryDto.prototype, "type", 2);
__decorateClass([
  IsOptional2(),
  IsString2()
], TradeListQueryDto.prototype, "status", 2);
__decorateClass([
  IsOptional2(),
  Type2(() => Number),
  IsNumber()
], TradeListQueryDto.prototype, "companyId", 2);
__decorateClass([
  IsOptional2(),
  Type2(() => Number),
  IsNumber()
], TradeListQueryDto.prototype, "minTotalAmount", 2);
__decorateClass([
  IsOptional2(),
  Type2(() => Number),
  IsNumber()
], TradeListQueryDto.prototype, "maxTotalAmount", 2);
__decorateClass([
  IsOptional2(),
  IsString2()
], TradeListQueryDto.prototype, "createdAtFrom", 2);
__decorateClass([
  IsOptional2(),
  IsString2()
], TradeListQueryDto.prototype, "createdAtTo", 2);
__decorateClass([
  IsOptional2(),
  IsString2()
], TradeListQueryDto.prototype, "orgId", 2);
var CreateTradeLineItemDto = class {
  productId;
  quantity;
  unitPrice;
  taxRatePercent;
};
__decorateClass([
  Type2(() => Number),
  IsNumber()
], CreateTradeLineItemDto.prototype, "productId", 2);
__decorateClass([
  Type2(() => Number),
  IsNumber(),
  Min2(0)
], CreateTradeLineItemDto.prototype, "quantity", 2);
__decorateClass([
  Type2(() => Number),
  IsNumber(),
  Min2(0)
], CreateTradeLineItemDto.prototype, "unitPrice", 2);
__decorateClass([
  IsOptional2(),
  Type2(() => Number),
  IsNumber(),
  Min2(0)
], CreateTradeLineItemDto.prototype, "taxRatePercent", 2);
var UpdateApprovalDto = class {
  approvalStatus;
};
__decorateClass([
  IsIn2(["pending", "approved", "rejected"])
], UpdateApprovalDto.prototype, "approvalStatus", 2);
export {
  ApprovalRole,
  CreateTradeLineItemDto,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  Filter,
  MAX_LIMIT,
  ORG_LIST_CACHE_CONFIG,
  OrgCrudController,
  OrgCrudService,
  OrgListCache,
  OrgNestedCrudService,
  PaginationQueryDto,
  SortQueryDto,
  TradeListQueryDto,
  UpdateApprovalDto,
  applyApprovalUpdate,
  applySearch,
  approvalOnApprove,
  approvalOnCreate,
  buildApprovalStatusPatch,
  buildWhereFromQuery,
  canSetApprovalStatus,
  defaultOrgListCache,
  defineResource,
  findManyPaginated,
  isPrismaUnique,
  mapApprovableCreate,
  mapPrismaUnique,
  paginatedResult,
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
  withActor
};
