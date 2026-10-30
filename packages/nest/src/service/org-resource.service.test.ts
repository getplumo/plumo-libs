import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { OrgListCache } from "../cache/org-list-cache.js"
import type { OrgRow, WhereClause } from "../core/types.js"
import { prismaAdapterUniqueError } from "../prisma/unique.js"
import { Filter } from "../query/filters.js"
import { defineResource } from "../resource/resource.js"
import { createMockDelegate } from "../testing/mock-delegate.js"
import type { CreateContext, UpdateContext } from "./context.js"
import { OrgResourceService } from "./org-resource.service.js"

type Thing = { id: number; orgId: string; name: string; price?: number; approvalStatus?: string }
type CreateThing = { name: string; price?: number; companyId?: number }

const is404 = (e: unknown) => e instanceof NotFoundException

function setup(extra: Partial<Parameters<typeof defineResource<Thing>>[0]> = {}) {
  const thing = createMockDelegate()
  const company = createMockDelegate()
  const log: string[] = []
  const db = {
    thing,
    company,
    $transaction: async <R>(fn: (tx: unknown) => Promise<R>) => {
      log.push("tx:begin")
      const r = await fn({ thing, company, marker: "tx" })
      log.push("tx:commit")
      return r
    },
  }
  const resource = defineResource<Thing>({
    model: "thing",
    notFoundMessage: "Thing not found",
    search: ["name"],
    filters: { price: Filter.numberRange("minPrice", "maxPrice") },
    sortable: ["name"],
    ...extra,
  })
  return { thing, company, db, log, resource }
}

describe("OrgResourceService tenancy (NEST-D2/D3)", () => {
  it("update/destroy on another org's id → 404 and the row is unchanged", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "victim", name: "secret" })
    const svc = new OrgResourceService<{ row: Thing; create: CreateThing }>(db, resource)
    await assert.rejects(() => svc.update("attacker", 1, { name: "pwned" }), is404)
    await assert.rejects(() => svc.destroy("attacker", 1), is404)
    await assert.rejects(() => svc.retrieve("attacker", 1), is404)
    assert.deepEqual(thing.rows, [{ id: 1, orgId: "victim", name: "secret" }])
  })

  it("a scope returning { orgId: 'other' } still lists only own-org rows", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "mine" })
    thing.rows.push({ id: 2, orgId: "other", name: "theirs" })
    class Leaky extends OrgResourceService<{ row: Thing }> {
      protected override scope(): WhereClause {
        return { orgId: "other" }
      }
    }
    const svc = new Leaky(db, resource)
    const res = (await svc.list("me", {})) as { data: Thing[] }
    // AND-merged scope + tenancy last → contradiction → nothing leaks.
    assert.deepEqual(res.data.map((r) => r.id), [])
  })

  it("orgId / id in the payload are ignored on create and update", async () => {
    const { thing, db, resource } = setup()
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    const created = (await svc.create("me", { name: "a", orgId: "other", id: 99 })) as Thing
    assert.equal(created.orgId, "me")
    assert.notEqual(created.id, 99)
    await svc.update("me", created.id, { orgId: "other", name: "b" })
    assert.equal(thing.rows[0]?.orgId, "me")
    assert.equal(thing.rows[0]?.name, "b")
  })
})

describe("OrgResourceService lifecycle hooks", () => {
  it("runs before/after hooks and afterWrite callbacks in order, inside the tx", async () => {
    const { db, log, resource } = setup({ transactional: true })
    class Svc extends OrgResourceService<{ row: Thing; create: CreateThing }> {
      protected override beforeCreate(dto: CreateThing, ctx: CreateContext<Thing>) {
        log.push(`before:${(ctx.tx as { marker?: string }).marker}`)
        ctx.afterWrite((row) => {
          log.push(`afterWrite:${row.name}`)
        })
        return { ...dto, name: dto.name.toUpperCase() }
      }
      protected override afterCreate(row: Thing) {
        log.push(`after:${row.name}`)
      }
    }
    const row = (await new Svc(db, resource).create("me", { name: "x" })) as Thing
    assert.equal(row.name, "X")
    assert.deepEqual(log, ["tx:begin", "before:tx", "afterWrite:X", "after:X", "tx:commit"])
  })

  it("beforeUpdate receives the existing row; presentOne shapes the output", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "old", price: 5 })
    const seen: unknown[] = []
    class Svc extends OrgResourceService<{
      row: Thing
      update: { price?: number }
      output: Thing & { label: string }
    }> {
      protected override beforeUpdate(dto: { price?: number }, ctx: UpdateContext<Thing>) {
        seen.push(ctx.existing.price)
        return { ...dto }
      }
      protected override presentOne(row: Thing) {
        return { ...row, label: `${row.name}:${row.price}` }
      }
    }
    const out = await new Svc(db, resource).update("me", 1, { price: 7 })
    assert.deepEqual(seen, [5])
    assert.equal(out.label, "old:7")
  })

  it("a failing hook aborts the write (nothing persisted)", async () => {
    const { thing, db, resource } = setup({ transactional: true })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeCreate(): never {
        throw new ForbiddenException("nope")
      }
    }
    await assert.rejects(() => new Svc(db, resource).create("me", { name: "x" }), ForbiddenException)
    assert.equal(thing.rows.length, 0)
  })
})

describe("OrgResourceService declarative options", () => {
  it("relations: other-org FK → 404 with the configured message", async () => {
    const { company, db, resource } = setup({
      relations: { companyId: { model: "company", message: "Company not found", required: true } },
    })
    company.rows.push({ id: 1, orgId: "other" })
    const svc = new OrgResourceService<{ row: Thing; create: CreateThing }>(db, resource)
    await assert.rejects(
      () => svc.create("me", { name: "x", companyId: 1 }),
      (e: unknown) => is404(e) && (e as Error).message === "Company not found",
    )
    company.rows.push({ id: 2, orgId: "me" })
    await svc.create("me", { name: "x", companyId: 2 })
  })

  it("relations: optional FK is skipped when null/undefined", async () => {
    const { db, resource } = setup({
      relations: { companyId: { model: "company", message: "Company not found" } },
    })
    const svc = new OrgResourceService<{ row: Thing; create: CreateThing }>(db, resource)
    await svc.create("me", { name: "x" })
  })

  it("unique: P2002 → 409 with the field message (create only by default)", async () => {
    const { db, resource } = setup({ unique: { messages: { name: "Name already exists" } } })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeCreate(): never {
        throw prismaAdapterUniqueError(["orgId", "name"], "things_orgId_name_key")
      }
    }
    await assert.rejects(
      () => new Svc(db, resource).create("me", { name: "x" }),
      (e: unknown) => e instanceof ConflictException && (e as Error).message === "Name already exists",
    )
  })

  it("softDelete: destroy stamps the field and hides the row", async () => {
    const { thing, db, resource } = setup({ softDelete: { field: "deletedAt" } })
    thing.rows.push({ id: 1, orgId: "me", name: "a" })
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    await svc.destroy("me", 1)
    assert.ok(thing.rows[0]?.deletedAt instanceof Date)
    await assert.rejects(() => svc.retrieve("me", 1), is404)
    const res = (await svc.list("me", {})) as { data: OrgRow[] }
    assert.equal(res.data.length, 0)
  })

  it("listMode 'all' + listCache: cached until a write invalidates", async () => {
    const { thing, db, resource } = setup({ listMode: "all", listCache: { scope: "things" } })
    thing.rows.push({ id: 1, orgId: "me", name: "a" })
    const svc = new OrgResourceService<{ row: Thing }>(db, resource, new OrgListCache())
    assert.equal(((await svc.list("me")) as Thing[]).length, 1)
    thing.rows.push({ id: 2, orgId: "me", name: "b" })
    assert.equal(((await svc.list("me")) as Thing[]).length, 1)
    await svc.create("me", { name: "c" })
    assert.equal(((await svc.list("me")) as Thing[]).length, 3)
  })

  it("paginated list: search + filter + sort whitelist + envelope", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "Apple", price: 5 })
    thing.rows.push({ id: 2, orgId: "me", name: "apricot", price: 50 })
    thing.rows.push({ id: 3, orgId: "x", name: "apple", price: 5 })
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    const res = (await svc.list("me", { q: "ap", maxPrice: 10, page: 1, limit: 20 })) as {
      data: Thing[]
      pagination: unknown
    }
    assert.deepEqual(res.data.map((r) => r.id), [1])
    assert.deepEqual(res.pagination, { page: 1, limit: 20, total: 1, totalPages: 1 })
  })
})

describe("OrgResourceService.updateApproval", () => {
  const admin = { userId: "u1", orgRole: "org:admin" }
  const member = { userId: "u2", orgRole: "org:member" }

  it("unchanged status returns the row without writing", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "a", approvalStatus: "pending" })
    let writes = 0
    const update = thing.update.bind(thing)
    thing.update = async (args) => {
      writes++
      return update(args)
    }
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    const row = (await svc.updateApproval("me", 1, { approvalStatus: "pending" }, admin)) as Thing
    assert.equal(row.approvalStatus, "pending")
    assert.equal(writes, 0)
  })

  it("non-manager → 403; manager → patch + beforeApproval sees the change", async () => {
    const { thing, db, resource } = setup({ transactional: true })
    thing.rows.push({ id: 1, orgId: "me", name: "a", approvalStatus: "rejected" })
    const changes: string[] = []
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeApproval(ctx: Parameters<OrgResourceService<{ row: Thing }>["beforeApproval"]>[0]) {
        changes.push(`${ctx.change.from}->${ctx.change.to}`)
      }
    }
    const svc = new Svc(db, resource)
    await assert.rejects(
      () => svc.updateApproval("me", 1, { approvalStatus: "approved" }, member),
      ForbiddenException,
    )
    const row = (await svc.updateApproval("me", 1, { approvalStatus: "approved" }, admin)) as Thing & {
      approvedBy?: string
    }
    assert.equal(row.approvalStatus, "approved")
    assert.equal(row.approvedBy, "u1")
    assert.deepEqual(changes, ["rejected->approved"])
  })
})
