import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ConflictException } from "@nestjs/common"
import {
  mapPrismaUnique,
  prismaAdapterUniqueError,
  prismaUniqueError,
  prismaUniqueFields,
  prismaUniqueIncludes,
  prismaUniqueMatches,
} from "./unique.js"

describe("mapPrismaUnique", () => {
  it("maps field message", () => {
    const err = prismaUniqueError(["orgId", "quoteId"])
    assert.deepEqual(prismaUniqueFields(err), ["orgId", "quoteId"])
    assert.throws(
      () =>
        mapPrismaUnique(err, {
          quoteId: "Already converted",
          orderNumber: "Number clash",
        }),
      (e: unknown) =>
        e instanceof ConflictException && e.message === "Already converted",
    )
  })

  it("ignores non-P2002", () => {
    const other = new Error("boom")
    mapPrismaUnique(other, { quoteId: "x" })
    // did not throw
  })

  it("reads the Prisma 7 driver-adapter shape (fields + constraint name)", () => {
    const err = prismaAdapterUniqueError(
      ["orgId", "year"],
      "invoice_sequences_pkey",
      "InvoiceSequence",
    )
    assert.deepEqual(prismaUniqueFields(err), [
      "orgId",
      "year",
      "invoice_sequences_pkey",
    ])
    assert.equal(prismaUniqueIncludes(err, "year"), true)
    assert.equal(prismaUniqueIncludes(err, "quoteId"), false)
  })

  it("maps adapter errors by column and by index name", () => {
    const byColumn = prismaAdapterUniqueError(
      ["orgId", "quoteId"],
      "orders_orgId_quoteId_key",
    )
    assert.throws(
      () => mapPrismaUnique(byColumn, { quoteId: "Already converted" }),
      (e: unknown) =>
        e instanceof ConflictException && e.message === "Already converted",
    )
    const indexOnly = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: {
            kind: "UniqueConstraintViolation",
            constraint: { index: "delivery_notes_orgId_orderId_key" },
          },
        },
      },
    }
    assert.deepEqual(prismaUniqueFields(indexOnly), [
      "delivery_notes_orgId_orderId_key",
    ])
    assert.throws(
      () => mapPrismaUnique(indexOnly, { orderId: "Already delivered" }),
      (e: unknown) =>
        e instanceof ConflictException && e.message === "Already delivered",
    )
  })

  it("falls back when nothing matches", () => {
    const err = prismaAdapterUniqueError(["orgId", "code"], "products_orgId_code_key")
    assert.throws(
      () => mapPrismaUnique(err, { quoteId: "x" }, "Duplicate"),
      (e: unknown) => e instanceof ConflictException && e.message === "Duplicate",
    )
  })
})

describe("exact P2002 matching + fields in the 409 body (fix #6)", () => {
  const body = (e: unknown) => (e as ConflictException).getResponse() as Record<string, unknown>

  it("`name` does not match `displayName` (no substring matching)", () => {
    const err = prismaAdapterUniqueError(["orgId", "displayName"], "users_orgId_displayName_key")
    assert.equal(prismaUniqueIncludes(err, "name"), false)
    assert.equal(prismaUniqueIncludes(err, "displayName"), true)
    assert.throws(
      () => mapPrismaUnique(err, { name: "Name taken", displayName: "Display name taken" }),
      (e: unknown) => e instanceof ConflictException && e.message === "Display name taken",
    )
    const classic = prismaUniqueError(["orgId", "displayName"])
    assert.throws(
      () => mapPrismaUnique(classic, { name: "Name taken" }, "Duplicate"),
      (e: unknown) => e instanceof ConflictException && e.message === "Duplicate",
    )
  })

  it("index-only errors match whole name tokens, not substrings", () => {
    const indexOnly = {
      code: "P2002",
      meta: { driverAdapterError: { cause: { constraint: { index: "users_orgId_displayName_key" } } } },
    }
    assert.equal(prismaUniqueIncludes(indexOnly, "displayName"), true)
    assert.equal(prismaUniqueIncludes(indexOnly, "name"), false)
    assert.equal(prismaUniqueIncludes(indexOnly, "Name"), false)
  })

  it("matches a column set ('orgId,code') and an exact constraint name", () => {
    const err = prismaAdapterUniqueError(["orgId", "code"], "products_orgId_code_key")
    assert.equal(prismaUniqueMatches(err, "orgId,code"), true)
    assert.equal(prismaUniqueMatches(err, "code, orgId"), true)
    assert.equal(prismaUniqueMatches(err, "orgId,sku"), false)
    assert.equal(prismaUniqueMatches(err, "products_orgId_code_key"), true)
    assert.equal(prismaUniqueMatches(err, "products_orgId_code"), false)
    assert.equal(prismaUniqueMatches(new Error("x"), "code"), false)
  })

  it("409 body keeps statusCode/message and adds fields (without orgId)", () => {
    const err = prismaAdapterUniqueError(["orgId", "code"], "products_orgId_code_key")
    try {
      mapPrismaUnique(err, { code: "Code already exists" })
      assert.fail("should throw")
    } catch (e) {
      assert.ok(e instanceof ConflictException)
      assert.equal(e.getStatus(), 409)
      assert.equal(e.message, "Code already exists")
      assert.deepEqual(body(e), {
        statusCode: 409,
        message: "Code already exists",
        error: "Conflict",
        fields: ["code"],
      })
    }
    try {
      mapPrismaUnique(prismaUniqueError(["orgId", "sku"]), {}, "Duplicate")
      assert.fail("should throw")
    } catch (e) {
      assert.deepEqual(body(e), { statusCode: 409, message: "Duplicate", error: "Conflict", fields: ["sku"] })
    }
  })

  it("index-only error: fields come from the matched key", () => {
    const indexOnly = {
      code: "P2002",
      meta: { driverAdapterError: { cause: { constraint: { index: "orders_orgId_quoteId_key" } } } },
    }
    try {
      mapPrismaUnique(indexOnly, { quoteId: "Already converted" })
      assert.fail("should throw")
    } catch (e) {
      assert.deepEqual(body(e).fields, ["quoteId"])
      assert.equal((e as Error).message, "Already converted")
    }
  })
})
