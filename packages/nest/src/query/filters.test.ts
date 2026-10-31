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

describe("0.2.1 filter validation (fixes #1, #7)", () => {
  const is400 = (e: unknown) => e instanceof BadRequestException

  it("#1 dateRange: invalid date → 400 (not an Invalid Date passed to Prisma)", () => {
    const f = Filter.dateRange("from", "to")
    assert.throws(() => f.apply({ query: { from: "not-a-date" }, where: {}, field: "createdAt" }), is400)
    assert.throws(() => f.apply({ query: { to: "2026-13-45" }, where: {}, field: "createdAt" }), is400)
    const where: WhereClause = {}
    f.apply({ query: { from: "2026-01-02", to: "" }, where, field: "createdAt" })
    assert.deepEqual(where.createdAt, { gte: new Date("2026-01-02T00:00:00.000Z") })
  })

  it("#7 numberRange coerces strings and rejects non-numbers with 400", () => {
    const where: WhereClause = {}
    Filter.numberRange("min", "max").apply({ query: { min: "1.5", max: "10" }, where, field: "price" })
    assert.deepEqual(where.price, { gte: 1.5, lte: 10 })
    assert.throws(
      () => Filter.numberRange("min", "max").apply({ query: { min: "abc" }, where: {}, field: "price" }),
      is400,
    )
    assert.throws(
      () => Filter.numberRange("min", "max", { type: "int" }).apply({ query: { max: "2.5" }, where: {}, field: "year" }),
      is400,
    )
    assert.throws(
      () => Filter.numberRange("min", "max").apply({ query: { min: "5", max: "1" }, where: {}, field: "price" }),
      is400,
    )
  })

  it("#7 exact with a declared type coerces (int/number/boolean/date/string)", () => {
    const where: WhereClause = {}
    Filter.exact({ type: "int" }).apply({ query: { brandId: "3" }, where, field: "brandId" })
    Filter.exact("active", "boolean").apply({ query: { active: "false" }, where, field: "isActive" })
    Filter.exact({ type: "number" }).apply({ query: { rate: "0.2" }, where, field: "rate" })
    Filter.exact({ type: "date" }).apply({ query: { day: "2026-01-02" }, where, field: "day" })
    Filter.exact({ type: "string" }).apply({ query: { code: 12 }, where, field: "code" })
    assert.deepEqual(where, {
      brandId: 3,
      isActive: false,
      rate: 0.2,
      day: new Date("2026-01-02"),
      code: "12",
    })
  })

  it("#7 exact with a declared type → 400 on invalid input", () => {
    const bad: Array<[Parameters<typeof Filter.exact>[0], unknown]> = [
      [{ type: "int" }, "abc"],
      [{ type: "int" }, "1.5"],
      [{ type: "number" }, "1e"],
      [{ type: "boolean" }, "yes"],
      [{ type: "date" }, "nope"],
      [{ type: "int" }, ["1", "2"]],
    ]
    for (const [opts, value] of bad) {
      assert.throws(
        () => Filter.exact(opts).apply({ query: { x: value }, where: {}, field: "x" }),
        is400,
        `${JSON.stringify(opts)} ${JSON.stringify(value)}`,
      )
    }
  })

  it("exact without a type keeps the raw value (0.2.0 behaviour)", () => {
    const where: WhereClause = {}
    Filter.exact().apply({ query: { status: "open" }, where, field: "status" })
    Filter.exact("cid").apply({ query: { cid: "7" }, where, field: "companyId" })
    assert.deepEqual(where, { status: "open", companyId: "7" })
  })

  it("#7 inList with a type coerces every item", () => {
    const where: WhereClause = {}
    Filter.inList({ type: "int" }).apply({ query: { id: "1, 2,3" }, where, field: "id" })
    assert.deepEqual(where.id, { in: [1, 2, 3] })
    assert.throws(
      () => Filter.inList("id", "int").apply({ query: { id: "1,x" }, where: {}, field: "id" }),
      is400,
    )
  })

  it("#4 applySearch can drop mode: insensitive", () => {
    const where: WhereClause = {}
    applySearch(where, ["name"], "ab", false)
    assert.deepEqual(where.OR, [{ name: { contains: "ab" } }])
    applySearch(where, ["name"], "ab")
    assert.deepEqual(where.OR, [{ name: { contains: "ab", mode: "insensitive" } }])
  })
})
