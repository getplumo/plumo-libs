import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ForbiddenException } from "@nestjs/common"
import { orgIdFromAuth } from "./decorators.js"

describe("orgIdFromAuth (N-1)", () => {
  it("returns the trimmed token org", () => {
    assert.equal(orgIdFromAuth({ orgId: " org_a " }), "org_a")
  })
  it("403 when the token has no active org", () => {
    assert.throws(() => orgIdFromAuth({ orgId: "  " }), ForbiddenException)
    assert.throws(() => orgIdFromAuth({}), ForbiddenException)
  })
})
