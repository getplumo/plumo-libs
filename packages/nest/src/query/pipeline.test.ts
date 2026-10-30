import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { defineResource } from "../resource/resource.js"
import { Filter } from "./filters.js"
import {
  QueryStrategies,
  buildListWhere,
  planList,
  resolveOrder,
  runStrategies,
} from "./pipeline.js"

type Ret = { id: number; orgId: string; returnNumber: string; status: string; createdAt: Date }

const resource = defineResource<Ret>({
  model: "deliveryReturn",
  search: ["returnNumber", "deliveryNote.deliveryNoteNumber"],
  filters: { status: Filter.exact("status") },
  sortable: ["returnNumber", "createdAt"],
  sortDirectionParam: "sortOrder",
})

describe("query pipeline", () => {
  it("search supports dotted relation paths", () => {
    const where = buildListWhere(resource, "o", { q: "BL-1" })
    assert.deepEqual(where.OR, [
      { returnNumber: { contains: "BL-1", mode: "insensitive" } },
      { deliveryNote: { deliveryNoteNumber: { contains: "BL-1", mode: "insensitive" } } },
    ])
  })

  it("tenancy is applied last and cannot be overridden", () => {
    const where = runStrategies(
      [
        (ctx) => {
          ctx.where.orgId = "evil"
        },
        QueryStrategies.where({ orgId: "evil2" }),
      ],
      "me",
      { orgId: "evil3" },
    )
    assert.equal(where.orgId, "me")
    assert.deepEqual(where.AND, [{ orgId: "evil2" }])
  })

  it("where() strategies AND-merge instead of clobbering search OR", () => {
    const where = buildListWhere(resource, "o", { q: "x" }, { OR: [{ status: "a" }] })
    assert.ok(Array.isArray(where.OR))
    assert.deepEqual(where.AND, [{ OR: [{ status: "a" }] }])
  })

  it("sortBy whitelist + legacy direction alias", () => {
    assert.deepEqual(resolveOrder(resource, { sortBy: "returnNumber", sortOrder: "asc" }), {
      returnNumber: "asc",
    })
    assert.deepEqual(resolveOrder(resource, { sortBy: "orgId" }), { createdAt: "desc" })
    assert.deepEqual(resolveOrder(resource, { sortBy: "createdAt" }), { createdAt: "desc" })
  })

  it("planList returns where, order and the page window", () => {
    const plan = planList(resource, "o", { status: "open", page: 3, limit: 10 })
    assert.deepEqual(plan.where, { status: "open", orgId: "o" })
    assert.equal(plan.skip, 20)
    assert.equal(plan.limit, 10)
  })
})
