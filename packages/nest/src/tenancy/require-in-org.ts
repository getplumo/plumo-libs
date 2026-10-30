import { NotFoundException } from "@nestjs/common"
import type { ModelDelegate, OrgRow } from "../core/types.js"

/** Minimal surface for membership checks. */
export type OrgScopedDelegate = {
  findFirst(args: {
    where: Record<string, unknown>
  }): Promise<OrgRow | null>
  findMany?(args: {
    where: Record<string, unknown>
  }): Promise<OrgRow[]>
}

/**
 * Load a row by `{ id, orgId }` or throw NotFound.
 * Replaces private `assertXInOrg` / findOne NotFound helpers across modules.
 */
export async function requireInOrg(
  delegate: OrgScopedDelegate,
  orgId: string,
  id: number,
  message = "Not found",
): Promise<OrgRow> {
  const row = await delegate.findFirst({ where: { id, orgId } })
  if (!row) {
    throw new NotFoundException(message)
  }
  return row
}

/** Alias — same as requireInOrg for related FKs (company, brand, taxRate, …). */
export const requireRelatedInOrg = requireInOrg

/**
 * Ensure every id belongs to org. Empty list is a no-op.
 * Replaces `assertProductsInOrg` / multi-id membership checks.
 */
export async function requireAllRelatedInOrg(
  delegate: OrgScopedDelegate,
  orgId: string,
  ids: number[],
  message = "One or more related records not found",
): Promise<OrgRow[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))]
  if (unique.length === 0) return []

  if (!delegate.findMany) {
    const rows: OrgRow[] = []
    for (const id of unique) {
      rows.push(await requireInOrg(delegate, orgId, id, message))
    }
    return rows
  }

  const rows = await delegate.findMany({
    where: { orgId, id: { in: unique } },
  })
  if (rows.length !== unique.length) {
    throw new NotFoundException(message)
  }
  return rows
}

/** Convenience: requireInOrg typed against a full ModelDelegate. */
export async function requireInOrgModel(
  delegate: ModelDelegate,
  orgId: string,
  id: number,
  message?: string,
): Promise<OrgRow> {
  return requireInOrg(delegate, orgId, id, message)
}
