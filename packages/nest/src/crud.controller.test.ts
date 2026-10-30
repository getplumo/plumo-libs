import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ForbiddenException } from "@nestjs/common"
import { OrgCrudService } from "./crud.service.js"
import { OrgCrudController } from "./crud.controller.js"
import { defineResource } from "./resource.js"
import { createMockDelegate } from "./test-mock-delegate.js"

class Ctrl extends OrgCrudController {
  constructor(protected readonly service: OrgCrudService) {
    super()
  }
}

function setup() {
  const thing = createMockDelegate()
  const service = new OrgCrudService({ thing }, defineResource({ model: "thing" }))
  return { thing, ctrl: new Ctrl(service) }
}

describe("OrgCrudController tenant resolution (N-1 regression)", () => {
  it("never uses ?orgId= when the token has no org (403 on every route)", async () => {
    const { thing, ctrl } = setup()
    thing.rows.push({ id: 1, orgId: "victim", name: "secret" })
    const noOrg = { auth: { orgId: null } }
    const q = { orgId: "victim" }
    const forbidden = (e: unknown) => e instanceof ForbiddenException
    await assert.rejects(async () => ctrl.findAll(noOrg, q), forbidden)
    await assert.rejects(async () => ctrl.findOne(noOrg, 1, q), forbidden)
    await assert.rejects(async () => ctrl.create(noOrg, { name: "x" }, q), forbidden)
    await assert.rejects(async () => ctrl.update(noOrg, 1, { name: "x" }, q), forbidden)
    await assert.rejects(async () => ctrl.remove(noOrg, 1, q), forbidden)
    await assert.rejects(async () => ctrl.findAll({}, q), forbidden)
    await assert.rejects(async () => ctrl.findAll({ auth: { orgId: "  " } }, q), forbidden)
    assert.equal(thing.rows[0]?.name, "secret")
  })

  it("token org wins over ?orgId= and another org's id is 404", async () => {
    const { thing, ctrl } = setup()
    thing.rows.push({ id: 1, orgId: "victim", name: "secret" })
    thing.rows.push({ id: 2, orgId: "attacker", name: "mine" })
    const me = { auth: { orgId: "attacker" } }
    const listed = (await ctrl.findAll(me, { orgId: "victim" })) as {
      data: Array<{ id: number }>
    }
    assert.deepEqual(
      listed.data.map((r) => r.id),
      [2],
    )
    await assert.rejects(
      async () => ctrl.findOne(me, 1, { orgId: "victim" }),
      (e: unknown) => (e as { status?: number }).status === 404,
    )
    await assert.rejects(
      async () => ctrl.remove(me, 1, {}),
      (e: unknown) => (e as { status?: number }).status === 404,
    )
    assert.equal(thing.rows.length, 2)
  })
})
