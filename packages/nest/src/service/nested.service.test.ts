import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NotFoundException } from "@nestjs/common"
import { OrgNestedCrudService } from "./nested.service.js"
import { createMockDelegate } from "../testing/mock-delegate.js"

describe("OrgNestedCrudService", () => {
  it("CRUD children under parent", async () => {
    const ticket = createMockDelegate()
    const comment = createMockDelegate()
    const nested = new OrgNestedCrudService(
      { savTicket: ticket, savTicketComment: comment },
      {
        parentModel: "savTicket",
        childModel: "savTicketComment",
        parentFk: "ticketId",
      },
    )

    const parent = await ticket.create({
      data: { orgId: "o1", subject: "Bug" },
    })
    const c = await nested.createChild("o1", parent.id, {
      content: "hi",
      author: "Ada",
    })
    assert.equal(c.ticketId, parent.id)

    const list = await nested.listChildren("o1", parent.id)
    assert.equal(list.length, 1)

    await nested.updateChild("o1", parent.id, c.id, { content: "updated" })
    await nested.destroyChild("o1", parent.id, c.id)
    assert.equal((await nested.listChildren("o1", parent.id)).length, 0)

    await assert.rejects(
      () => nested.createChild("o1", 999, { content: "x" }),
      NotFoundException,
    )
  })
})
