import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BadRequestException } from "@nestjs/common"
import { Filter, applySearch, type WhereClause } from "./filters.js"

describe("Filter.exact", () => {
  it("sets field from query", () => {
    const where: WhereClause = { orgId: "o1" }
    Filter.exact().apply({
      query: { brandId: 3 },
      where,
      field: "brandId",
    })
    assert.equal(where.brandId, 3)
  })

  it("skips empty", () => {
    const where: WhereClause = { orgId: "o1" }
    Filter.exact().apply({
      query: { brandId: "" },
      where,
      field: "brandId",
    })
    assert.equal(where.brandId, undefined)
  })
})

describe("Filter.numberRange", () => {
  it("builds gte/lte", () => {
    const where: WhereClause = {}
    Filter.numberRange("minPrice", "maxPrice").apply({
      query: { minPrice: 10, maxPrice: 100 },
      where,
      field: "sellPrice",
    })
    assert.deepEqual(where.sellPrice, { gte: 10, lte: 100 })
  })

  it("rejects inverted range", () => {
    assert.throws(
      () =>
        Filter.numberRange("minPrice", "maxPrice").apply({
          query: { minPrice: 100, maxPrice: 10 },
          where: {},
          field: "sellPrice",
        }),
      BadRequestException,
    )
  })
})

describe("Filter.inList", () => {
  it("splits csv", () => {
    const where: WhereClause = {}
    Filter.inList().apply({
      query: { status: "a,b" },
      where,
      field: "status",
    })
    assert.deepEqual(where.status, { in: ["a", "b"] })
  })
})

describe("applySearch", () => {
  it("adds OR contains", () => {
    const where: WhereClause = { orgId: "o1" }
    applySearch(where, ["name", "email"], "ada")
    assert.deepEqual(where.OR, [
      { name: { contains: "ada", mode: "insensitive" } },
      { email: { contains: "ada", mode: "insensitive" } },
    ])
  })
})
