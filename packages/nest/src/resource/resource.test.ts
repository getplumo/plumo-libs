import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Filter } from "../query/filters.js"
import {
  buildWhereFromQuery,
  defineResource,
  resolveOrder,
} from "./resource.js"

const contactResource = defineResource({
  model: "contact",
  search: ["firstName", "email"],
  filters: {
    email: Filter.exact(),
  },
  sortable: ["createdAt", "firstName"],
  defaultOrder: { createdAt: "desc" },
})

describe("defineResource", () => {
  it("defaults notFoundMessage", () => {
    assert.equal(contactResource.notFoundMessage, "contact not found")
  })
})

describe("buildWhereFromQuery", () => {
  it("always scopes orgId", () => {
    const where = buildWhereFromQuery(contactResource, "org_1", {})
    assert.equal(where.orgId, "org_1")
  })

  it("applies exact + search", () => {
    const where = buildWhereFromQuery(contactResource, "org_1", {
      email: "a@b.com",
      q: "Ada",
    })
    assert.equal(where.email, "a@b.com")
    assert.ok(Array.isArray(where.OR))
  })
})

describe("resolveOrder", () => {
  it("uses sortable field", () => {
    assert.deepEqual(
      resolveOrder(contactResource, { sortBy: "firstName", sortDirection: "asc" }),
      { firstName: "asc" },
    )
  })

  it("falls back to default", () => {
    assert.deepEqual(resolveOrder(contactResource, { sortBy: "hack" }), {
      createdAt: "desc",
    })
  })
})
