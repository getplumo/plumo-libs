import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { OrgCrudService } from "./crud.service.js"
import { OrgCrudController } from "./crud.controller.js"
import { defineResource } from "../resource/resource.js"
import { OrgListCache } from "../cache/org-list-cache.js"
import { createMockDelegate } from "../testing/mock-delegate.js"

/** Mirrors obs-api-v2 categories.resource + controller wiring. */
const categoryResource = defineResource({
  model: "category",
  notFoundMessage: "Category not found",
  search: ["name", "code", "description"],
  sortable: ["createdAt", "name", "code"],
  defaultOrder: { createdAt: "desc" },
  listMode: "all",
  listCache: { scope: "categories" },
})

class CategoriesLikeController extends OrgCrudController {
  constructor(protected readonly service: OrgCrudService) {
    super()
  }
}

describe("categories-style OrgCrudController", () => {
  it("CRUD + listMode all + org from auth only", async () => {
    const category = createMockDelegate()
    const service = new OrgCrudService(
      { category },
      categoryResource,
      new OrgListCache(),
    )
    const ctrl = new CategoriesLikeController(service)
    const req = { auth: { orgId: "org_test" } }

    const created = await ctrl.create(req, { name: "Drinks", code: "DRK" }, {})
    assert.equal(created.orgId, "org_test")

    const listed = await ctrl.findAll(req, {})
    assert.ok(Array.isArray(listed))
    assert.equal(listed.length, 1)

    const one = await ctrl.findOne(req, created.id as number, {})
    assert.equal(one.code, "DRK")

    const updated = await ctrl.update(
      req,
      created.id as number,
      { name: "Beverages" },
      {},
    )
    assert.equal(updated.name, "Beverages")

    await ctrl.remove(req, created.id as number, {})
    assert.equal((await ctrl.findAll(req, {})).length, 0)

    await assert.rejects(
      async () => ctrl.create({ auth: {} }, { name: "Q", code: "Q1" }, { orgId: "org_q" }),
      (e: unknown) => (e as { status?: number }).status === 403,
    )
    await assert.rejects(
      async () => ctrl.findAll({ auth: {} }, { orgId: "org_q" }),
      (e: unknown) => (e as { status?: number }).status === 403,
    )
  })
})
