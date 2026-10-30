import {
  paginatedResult,
  resolvePagination,
  type PaginatedResult,
} from "../query/pagination.js"
import { resolveOrder, type DefinedResource } from "../resource/resource.js"
import { buildListWhere } from "../query/pipeline.js"
import type {
  DelegateHost,
  ModelDelegate,
  OrgRow,
} from "../core/types.js"
import { requireInOrg } from "../tenancy/require-in-org.js"
import {
  defaultOrgListCache,
  type OrgListCache,
} from "../cache/org-list-cache.js"

export type ListResult = PaginatedResult<OrgRow> | OrgRow[]

/**
 * DRF ModelViewSet analogue — org-scoped CRUD (0.1 API).
 *
 * @deprecated Use `OrgResourceService` (typed, lifecycle hooks, transactions).
 * Kept for backward compatibility. Since 0.2 it also enforces the tenant on
 * writes (`where: { id, orgId }`) and applies `extraWhere` before tenancy, so
 * it can no longer override `orgId`.
 */
export class OrgCrudService {
  constructor(
    protected readonly db: DelegateHost,
    protected readonly resource: DefinedResource,
    protected readonly listCache: OrgListCache = defaultOrgListCache,
  ) {
    const cfg = resource.listCache
    if (cfg?.dependsOn?.length) {
      listCache.registerDependencies(cfg.scope, cfg.dependsOn)
    }
  }

  protected get delegate(): ModelDelegate {
    const d = (this.db as Record<string, unknown>)[this.resource.model]
    if (!d || typeof d !== "object") {
      throw new Error(`No delegate for model "${this.resource.model}"`)
    }
    return d as ModelDelegate
  }

  protected get listMode(): "paginated" | "all" {
    return this.resource.listMode ?? "paginated"
  }

  /**
   * List rows for org.
   * - `listMode: 'paginated'` (default) → `{ data, pagination }`
   * - `listMode: 'all'` → full array (filters/search still apply; no skip/take)
   */
  async list(
    orgId: string,
    query: Record<string, unknown> = {},
  ): Promise<ListResult> {
    const load = (): Promise<ListResult> =>
      this.listMode === "all"
        ? this.loadListAll(orgId, query)
        : this.loadListPage(orgId, query)
    const cfg = this.resource.listCache
    if (!cfg) return load()
    const variant = this.listMode === "all" && Object.keys(query).length === 0
      ? ""
      : query
    return this.listCache.getOrSet<ListResult>(
      cfg.scope,
      orgId,
      variant,
      load,
      { ttlMs: cfg.ttlMs },
    )
  }

  protected buildListWhere(
    orgId: string,
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    // Tenancy last: extraWhere is AND-merged and cannot replace orgId.
    return buildListWhere(
      this.resource,
      orgId,
      query,
      this.extraWhere(orgId, query),
    )
  }

  protected listFindArgs(where: Record<string, unknown>, orderBy: unknown) {
    return {
      where,
      orderBy,
      ...(this.resource.listSelect
        ? { select: this.resource.listSelect }
        : this.resource.include
          ? { include: this.resource.include }
          : {}),
    }
  }

  protected async loadListAll(
    orgId: string,
    query: Record<string, unknown>,
  ): Promise<OrgRow[]> {
    const where = this.buildListWhere(orgId, query)
    const orderBy = resolveOrder(this.resource, query as never)
    const data = await this.delegate.findMany(
      this.listFindArgs(where, orderBy),
    )
    return data.map((row) => this.transformListItem(row))
  }

  protected async loadListPage(
    orgId: string,
    query: Record<string, unknown>,
  ): Promise<PaginatedResult<OrgRow>> {
    const { page, limit, skip } = resolvePagination(query)
    const where = this.buildListWhere(orgId, query)
    const orderBy = resolveOrder(this.resource, query as never)

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        ...this.listFindArgs(where, orderBy),
        skip,
        take: limit,
      }),
      this.delegate.count({ where }),
    ])

    return paginatedResult(
      data.map((row) => this.transformListItem(row)),
      total,
      page,
      limit,
    )
  }

  async retrieve(orgId: string, id: number): Promise<OrgRow> {
    const row = await requireInOrg(
      this.delegate,
      orgId,
      id,
      this.resource.notFoundMessage,
    )
    return this.transformDetail(row)
  }

  /**
   * `data` is `any` and trailing args are open so domain services can use
   * concrete DTOs + ApprovalActor without TS2416.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(orgId: string, data: any, ..._extra: any[]): Promise<OrgRow> {
    const record = data as Record<string, unknown>
    await this.assertCreate(orgId, record)
    const payload = await this.mapCreateData(orgId, record)
    const { id: _id, ...createData } = payload
    const row = await this.delegate.create({
      data: { ...createData, orgId },
      ...(this.resource.include ? { include: this.resource.include } : {}),
    })
    this.invalidateListCache(orgId)
    return row
  }

  async update(
    orgId: string,
    id: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ..._extra: any[]
  ): Promise<OrgRow> {
    const record = data as Record<string, unknown>
    await this.retrieve(orgId, id)
    await this.assertUpdate(orgId, id, record)
    const payload = await this.mapUpdateData(orgId, id, record)
    const { orgId: _o, id: _i, ...updateData } = payload
    const row = await this.delegate.update({
      where: { id, orgId },
      data: updateData,
      ...(this.resource.include ? { include: this.resource.include } : {}),
    })
    this.invalidateListCache(orgId)
    return row
  }

  async destroy(orgId: string, id: number): Promise<OrgRow> {
    await this.retrieve(orgId, id)
    const row = await this.delegate.delete({ where: { id, orgId } })
    this.invalidateListCache(orgId)
    return row
  }

  protected invalidateListCache(orgId: string) {
    const cfg = this.resource.listCache
    if (cfg) this.listCache.invalidate(cfg.scope, orgId)
  }

  protected extraWhere(
    _orgId: string,
    _query: Record<string, unknown>,
  ): Record<string, unknown> {
    return {}
  }

  protected transformListItem(row: OrgRow): OrgRow {
    return row
  }

  protected transformDetail(row: OrgRow): OrgRow {
    return row
  }

  protected async assertCreate(
    _orgId: string,
    _data: Record<string, unknown>,
  ): Promise<void> {}

  protected async assertUpdate(
    _orgId: string,
    _id: number,
    _data: Record<string, unknown>,
  ): Promise<void> {}

  protected async mapCreateData(
    _orgId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return data
  }

  protected async mapUpdateData(
    _orgId: string,
    _id: number,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return data
  }
}
