import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NotFoundException } from "@nestjs/common"
import { OrgCrudService } from "./crud.service.js"
import { defineResource } from "../resource/resource.js"
import { Filter } from "../query/filters.js"
import { createMockDelegate } from "../testing/mock-delegate.js"
import {
  requireAllRelatedInOrg,
  requireInOrg,
} from "../tenancy/require-in-org.js"

const productResource = defineResource({
  model: "product",
  notFoundMessage: "Product not found",
  search: ["name"],
  filters: {
    brandId: Filter.exact(),
  },
  sortable: ["createdAt", "name"],
  defaultOrder: { createdAt: "desc" },
})

describe("OrgCrudService", () => {
  it("creates retrieves lists and destroys within org", async () => {
    const product = createMockDelegate()
    const db = { product }
    const svc = new OrgCrudService(db, productResource)

    const created = await svc.create("org_a", { name: "Laptop", brandId: 1 })
    assert.equal(created.orgId, "org_a")
    assert.equal(created.name, "Laptop")

    const one = await svc.retrieve("org_a", created.id)
    assert.equal(one.name, "Laptop")

    await assert.rejects(
      () => svc.retrieve("org_b", created.id),
      NotFoundException,
    )

    await svc.create("org_a", { name: "Cable", brandId: 2 })
    const listed = await svc.list("org_a", { brandId: 1 })
    assert.ok(!Array.isArray(listed))
    assert.equal(listed.data.length, 1)
    assert.equal(listed.data[0]?.name, "Laptop")

    await svc.destroy("org_a", created.id)
    assert.equal(await product.count({ where: { orgId: "org_a" } }), 1)
  })

  it("listMode all returns full array", async () => {
    const category = createMockDelegate()
    const svc = new OrgCrudService(
      { category },
      defineResource({
        model: "category",
        listMode: "all",
        listCache: { scope: "categories", ttlMs: 60_000 },
        defaultOrder: { createdAt: "desc" },
      }),
    )
    await svc.create("o1", { name: "A" })
    await svc.create("o1", { name: "B" })
    const all = await svc.list("o1", {})
    assert.ok(Array.isArray(all))
    assert.equal(all.length, 2)
  })
})

describe("requireInOrg", () => {
  it("loads or throws", async () => {
    const product = createMockDelegate()
    const row = await product.create({
      data: { orgId: "o1", name: "X" },
    })
    const found = await requireInOrg(product, "o1", row.id)
    assert.equal(found.name, "X")
    await assert.rejects(
      () => requireInOrg(product, "o1", 999, "missing"),
      (e: unknown) =>
        e instanceof NotFoundException && e.message === "missing",
    )
  })

  it("requireAllRelatedInOrg checks membership", async () => {
    const product = createMockDelegate()
    const a = await product.create({ data: { orgId: "o1", name: "A" } })
    const b = await product.create({ data: { orgId: "o1", name: "B" } })
    await product.create({ data: { orgId: "o2", name: "C" } })

    const rows = await requireAllRelatedInOrg(product, "o1", [a.id, b.id])
    assert.equal(rows.length, 2)

    await assert.rejects(
      () => requireAllRelatedInOrg(product, "o1", [a.id, 999]),
      NotFoundException,
    )
  })
})
