import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ConflictException } from "@nestjs/common"
import {
  mapPrismaUnique,
  prismaAdapterUniqueError,
  prismaUniqueError,
  prismaUniqueFields,
  prismaUniqueIncludes,
} from "./map-prisma-unique.js"

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
