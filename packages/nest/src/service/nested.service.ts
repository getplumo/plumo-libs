import { NotFoundException } from "@nestjs/common"
import type { DelegateHost, ModelDelegate, OrgRow } from "../core/types.js"
import { requireInOrg } from "../tenancy/require-in-org.js"

export type NestedResourceConfig = {
  /** Parent model key on PrismaService (e.g. 'savTicket'). */
  parentModel: string
  /** Child model key (e.g. 'savTicketComment'). */
  childModel: string
  /** FK on child pointing at parent id (e.g. 'ticketId'). */
  parentFk: string
  parentNotFound?: string
  childNotFound?: string
}

/**
 * Nested child CRUD under an org-scoped parent
 * (SAV comments, opportunity activities, …).
 */
export class OrgNestedCrudService {
  constructor(
    protected readonly db: DelegateHost,
    protected readonly config: NestedResourceConfig,
  ) {}

  protected get parentDelegate(): ModelDelegate {
    return this.delegate(this.config.parentModel)
  }

  protected get childDelegate(): ModelDelegate {
    return this.delegate(this.config.childModel)
  }

  protected delegate(model: string): ModelDelegate {
    const d = (this.db as Record<string, unknown>)[model]
    if (!d || typeof d !== "object") {
      throw new Error(`No delegate for model "${model}"`)
    }
    return d as ModelDelegate
  }

  protected async requireParent(
    orgId: string,
    parentId: number,
  ): Promise<OrgRow> {
    return requireInOrg(
      this.parentDelegate,
      orgId,
      parentId,
      this.config.parentNotFound ?? `${this.config.parentModel} not found`,
    )
  }

  protected async requireChild(
    orgId: string,
    parentId: number,
    childId: number,
  ): Promise<OrgRow> {
    const row = await this.childDelegate.findFirst({
      where: {
        id: childId,
        orgId,
        [this.config.parentFk]: parentId,
      },
    })
    if (!row) {
      throw new NotFoundException(
        this.config.childNotFound ?? `${this.config.childModel} not found`,
      )
    }
    return row
  }

  async listChildren(orgId: string, parentId: number): Promise<OrgRow[]> {
    await this.requireParent(orgId, parentId)
    return this.childDelegate.findMany({
      where: { orgId, [this.config.parentFk]: parentId },
      orderBy: { createdAt: "asc" },
    })
  }

  async createChild(
    orgId: string,
    parentId: number,
    data: Record<string, unknown>,
  ): Promise<OrgRow> {
    await this.requireParent(orgId, parentId)
    return this.childDelegate.create({
      data: {
        ...data,
        orgId,
        [this.config.parentFk]: parentId,
      },
    })
  }

  async updateChild(
    orgId: string,
    parentId: number,
    childId: number,
    data: Record<string, unknown>,
  ): Promise<OrgRow> {
    await this.requireChild(orgId, parentId, childId)
    return this.childDelegate.update({ where: { id: childId }, data })
  }

  async destroyChild(
    orgId: string,
    parentId: number,
    childId: number,
  ): Promise<OrgRow> {
    await this.requireChild(orgId, parentId, childId)
    return this.childDelegate.delete({ where: { id: childId } })
  }
}
