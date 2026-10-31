import { BadRequestException, ForbiddenException } from "@nestjs/common"

export type ApprovalStatusValue = "pending" | "approved" | "rejected"

/** The only accepted approval statuses. */
export const APPROVAL_STATUSES: readonly ApprovalStatusValue[] = [
  "pending",
  "approved",
  "rejected",
]

export function isApprovalStatus(value: unknown): value is ApprovalStatusValue {
  return (
    typeof value === "string" &&
    (APPROVAL_STATUSES as readonly string[]).includes(value)
  )
}

/** 400 unless `value` is pending / approved / rejected (works without a DTO). */
export function assertApprovalStatus(
  value: unknown,
): asserts value is ApprovalStatusValue {
  if (!isApprovalStatus(value)) {
    throw new BadRequestException(
      `approvalStatus must be one of: ${APPROVAL_STATUSES.join(", ")}`,
    )
  }
}

export type ApprovalActor = {
  userId: string
  orgRole?: string | null
}

export type ApprovalFields = {
  createdBy: string
  approvedBy: string | null
  approvedAt: Date | null
  approvalStatus: ApprovalStatusValue
}

export type ApprovalStatusPatch = {
  approvedBy: string | null
  approvedAt: Date | null
  approvalStatus: ApprovalStatusValue
}

/** Mirror Clerk org roles used by obs-api-v2 (no API import). */
export const ApprovalRole = {
  ADMIN: "org:admin",
  MANAGER: "org:manager",
  POS: "org:pos",
} as const

/** Manager/Admin/POS creates → auto-approved; others → pending. */
export function approvalOnCreate(actor: ApprovalActor): ApprovalFields {
  const auto =
    actor.orgRole === ApprovalRole.ADMIN ||
    actor.orgRole === ApprovalRole.MANAGER ||
    actor.orgRole === ApprovalRole.POS
  if (auto) {
    const now = new Date()
    return {
      createdBy: actor.userId,
      approvedBy: actor.userId,
      approvedAt: now,
      approvalStatus: "approved",
    }
  }
  return {
    createdBy: actor.userId,
    approvedBy: null,
    approvedAt: null,
    approvalStatus: "pending",
  }
}

export function approvalOnApprove(approverUserId: string): {
  approvedBy: string
  approvedAt: Date
  approvalStatus: "approved"
} {
  return {
    approvedBy: approverUserId,
    approvedAt: new Date(),
    approvalStatus: "approved",
  }
}

export function canSetApprovalStatus(orgRole?: string | null): boolean {
  return orgRole === ApprovalRole.ADMIN || orgRole === ApprovalRole.MANAGER
}

/**
 * Build DB patch for an approval status change.
 * Throws 400 when `next` is not pending/approved/rejected.
 * Returns null when status is unchanged. Throws 403 if actor cannot approve.
 */
export function buildApprovalStatusPatch(
  current: ApprovalStatusValue,
  next: ApprovalStatusValue,
  actor: ApprovalActor,
): ApprovalStatusPatch | null {
  assertApprovalStatus(next)
  if (next === current) return null
  if (!canSetApprovalStatus(actor.orgRole)) {
    throw new ForbiddenException(
      "Only manager or admin can change approval status",
    )
  }
  if (next === "approved") {
    return approvalOnApprove(actor.userId)
  }
  if (next === "pending") {
    return {
      approvalStatus: "pending",
      approvedBy: null,
      approvedAt: null,
    }
  }
  return {
    approvalStatus: "rejected",
    approvedBy: actor.userId,
    approvedAt: new Date(),
  }
}

type ApprovalRow = { approvalStatus: ApprovalStatusValue }

/**
 * Shared updateApproval flow used by quotes/orders/DN/invoices/payments/expenses.
 */
export async function applyApprovalUpdate<T extends ApprovalRow>(
  current: T,
  next: ApprovalStatusValue,
  actor: ApprovalActor,
  update: (patch: ApprovalStatusPatch) => Promise<T>,
): Promise<T> {
  const patch = buildApprovalStatusPatch(current.approvalStatus, next, actor)
  if (!patch) return current
  return update(patch)
}
