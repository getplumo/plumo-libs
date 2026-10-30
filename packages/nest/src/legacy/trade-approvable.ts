import {
  approvalOnCreate,
  applyApprovalUpdate,
  type ApprovalActor,
  type ApprovalStatusPatch,
  type ApprovalStatusValue,
} from "../approval/approval.js"
import type { OrgRow } from "../core/types.js"

/**
 * Shared create payload bits for approvable trade/finance docs.
 * Amount normalization stays in the app via `@plumo/money` — pass already-normalized values.
 *
 * @deprecated Use `approvalOnCreate(actor)` inside a `beforeCreate` hook.
 */
export function mapApprovableCreate(
  data: Record<string, unknown>,
  extras: {
    numberField: string
    numberPrefix: string
    nextSeq: number
    amountField?: string
  },
): Record<string, unknown> {
  const actor = (data._actor as ApprovalActor | undefined) ?? {
    userId: "system",
    orgRole: null,
  }
  const { _actor, ...rest } = data
  const amountField = extras.amountField ?? "totalAmount"
  return {
    ...rest,
    [extras.numberField]: `${extras.numberPrefix}-${String(extras.nextSeq).padStart(4, "0")}`,
    status: rest.status ?? "draft",
    ...(rest[amountField] != null ? { [amountField]: rest[amountField] } : {}),
    ...approvalOnCreate(actor),
  }
}

/** @deprecated Use `OrgResourceService.updateApproval`. */
export async function runApprovalUpdate(
  row: OrgRow & { approvalStatus: ApprovalStatusValue },
  next: ApprovalStatusValue,
  actor: ApprovalActor,
  update: (patch: ApprovalStatusPatch) => Promise<OrgRow>,
): Promise<OrgRow> {
  return applyApprovalUpdate(row, next, actor, async (patch) => {
    const updated = await update(patch)
    return updated as typeof row
  })
}

/** @deprecated Actors are passed as the 3rd argument of create/update. */
export function withActor(
  data: Record<string, unknown>,
  actor?: ApprovalActor,
): Record<string, unknown> {
  return actor ? { ...data, _actor: actor } : data
}
