import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { OrgListCache } from "./org-list-cache.js"
import { OrgCrudService } from "../legacy/crud.service.js"
import { defineResource } from "../resource/resource.js"
import { createMockDelegate } from "../testing/mock-delegate.js"

describe("OrgListCache", () => {
  it("caches getOrSet until invalidate", async () => {
    const cache = new OrgListCache()
    let loads = 0
    const load = async () => {
      loads += 1
      return { n: loads }
    }
    await cache.getOrSet("brands", "o1", "", load, { ttlMs: 60_000 })
    await cache.getOrSet("brands", "o1", "", load, { ttlMs: 60_000 })
    assert.equal(loads, 1)
    cache.invalidate("brands", "o1")
    await cache.getOrSet("brands", "o1", "", load, { ttlMs: 60_000 })
    assert.equal(loads, 2)
  })
})

describe("OrgCrudService listCache", () => {
  it("invalidates on create", async () => {
    const brand = createMockDelegate()
    const cache = new OrgListCache()
    const resource = defineResource({
      model: "brand",
      listCache: { scope: "brands", ttlMs: 60_000 },
    })
    const svc = new OrgCrudService({ brand }, resource, cache)

    await svc.create("o1", { name: "A" })
    const first = await svc.list("o1", {})
    assert.ok(!Array.isArray(first))
    assert.equal(first.data.length, 1)

    // mutate underlying store without going through service — cache would be stale
    await brand.create({ data: { orgId: "o1", name: "ghost" } })
    const cached = await svc.list("o1", {})
    assert.ok(!Array.isArray(cached))
    assert.equal(cached.data.length, 1)

    await svc.create("o1", { name: "B" })
    const after = await svc.list("o1", {})
    assert.ok(!Array.isArray(after))
    assert.equal(after.data.length, 3)
  })
})

describe("OrgListCache dependencies and config", () => {
  it("invalidating a parent scope clears dependent scopes (brands embed categories)", async () => {
    const cache = new OrgListCache()
    cache.registerDependencies("brands", ["categories"])
    let loads = 0
    const load = async () => ++loads
    await cache.getOrSet("brands", "o1", "", load)
    await cache.getOrSet("brands", "o2", "", load)
    assert.equal(loads, 2)
    cache.invalidate("categories", "o1")
    await cache.getOrSet("brands", "o1", "", load)
    assert.equal(loads, 3, "o1 brands reloaded")
    await cache.getOrSet("brands", "o2", "", load)
    assert.equal(loads, 3, "o2 untouched")
  })

  it("dependency cycles do not loop forever", () => {
    const cache = new OrgListCache()
    cache.registerDependencies("a", ["b"])
    cache.registerDependencies("b", ["a"])
    cache.invalidate("a", "o1")
  })

  it("OrgCrudService registers resource.listCache.dependsOn", async () => {
    const brand = createMockDelegate()
    const category = createMockDelegate()
    const cache = new OrgListCache()
    const brandSvc = new OrgCrudService(
      { brand },
      defineResource({
        model: "brand",
        listMode: "all",
        listCache: { scope: "brands", dependsOn: ["categories"] },
      }),
      cache,
    )
    const categorySvc = new OrgCrudService(
      { category },
      defineResource({
        model: "category",
        listMode: "all",
        listCache: { scope: "categories" },
      }),
      cache,
    )
    await brandSvc.create("o1", { name: "B" })
    assert.equal(((await brandSvc.list("o1")) as unknown[]).length, 1)
    brand.rows.push({ id: 99, orgId: "o1", name: "sneaked in" })
    assert.equal(((await brandSvc.list("o1")) as unknown[]).length, 1, "cached")
    await categorySvc.create("o1", { name: "C" })
    assert.equal(((await brandSvc.list("o1")) as unknown[]).length, 2, "invalidated via categories")
  })

  it("enabled:false is a pass-through", async () => {
    const cache = new OrgListCache({ enabled: false })
    let loads = 0
    const load = async () => ++loads
    await cache.getOrSet("x", "o1", "", load)
    await cache.getOrSet("x", "o1", "", load)
    assert.equal(loads, 2)
  })
})
