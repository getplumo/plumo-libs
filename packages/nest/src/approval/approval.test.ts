import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ForbiddenException } from "@nestjs/common"
import {
  ApprovalRole,
  approvalOnCreate,
  applyApprovalUpdate,
  buildApprovalStatusPatch,
} from "./approval.js"

describe("approvalOnCreate", () => {
  it("auto-approves manager", () => {
    const a = approvalOnCreate({
      userId: "u1",
      orgRole: ApprovalRole.MANAGER,
    })
    assert.equal(a.approvalStatus, "approved")
    assert.equal(a.approvedBy, "u1")
  })

  it("pends cashier", () => {
    const a = approvalOnCreate({
      userId: "u2",
      orgRole: "org:cashier",
    })
    assert.equal(a.approvalStatus, "pending")
    assert.equal(a.approvedBy, null)
  })
})

describe("buildApprovalStatusPatch", () => {
  it("forbids non-manager", () => {
    assert.throws(
      () =>
        buildApprovalStatusPatch("pending", "approved", {
          userId: "u",
          orgRole: "org:cashier",
        }),
      ForbiddenException,
    )
  })

  it("returns null when unchanged", () => {
    assert.equal(
      buildApprovalStatusPatch("approved", "approved", {
        userId: "u",
        orgRole: ApprovalRole.ADMIN,
      }),
      null,
    )
  })
})

describe("applyApprovalUpdate", () => {
  it("updates via callback", async () => {
    const row = { approvalStatus: "pending" as const, id: 1 }
    const next = await applyApprovalUpdate(
      row,
      "approved",
      { userId: "mgr", orgRole: ApprovalRole.MANAGER },
      async (patch) => ({ ...row, ...patch }),
    )
    assert.equal(next.approvalStatus, "approved")
    assert.equal(next.approvedBy, "mgr")
  })
})
