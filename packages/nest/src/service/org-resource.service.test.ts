import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException } from "@nestjs/common"
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

describe("0.2.1 fixes", () => {
  const admin = { userId: "u1", orgRole: "org:admin" }

  it("#2 updateApproval: unknown / missing status → 400 without a DTO, nothing written", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "a", approvalStatus: "pending" })
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    for (const body of [{ approvalStatus: "archived" }, { approvalStatus: "" }, {}, undefined]) {
      await assert.rejects(
        () => svc.updateApproval("me", 1, body as never, admin),
        BadRequestException,
        JSON.stringify(body),
      )
    }
    assert.equal(thing.rows[0]?.approvalStatus, "pending")
  })

  it("#3 non-transactional: after-hook throws after the write → list cache (and dependants) still invalidated", async () => {
    const { thing, db, resource } = setup({ listMode: "all", listCache: { scope: "things" } })
    const cache = new OrgListCache()
    thing.rows.push({ id: 1, orgId: "me", name: "a" })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override afterCreate(): never {
        throw new Error("hook failed")
      }
    }
    const svc = new Svc(db, resource, cache)
    // A dependant scope embedding "things".
    const parent = new OrgResourceService<{ row: Thing }>(
      db,
      defineResource<Thing>({ model: "thing", listMode: "all", listCache: { scope: "parents", dependsOn: ["things"] } }),
      cache,
    )
    assert.equal(((await svc.list("me")) as Thing[]).length, 1)
    assert.equal(((await parent.list("me")) as Thing[]).length, 1)
    await assert.rejects(() => svc.create("me", { name: "b" }), /hook failed/)
    assert.equal(thing.rows.length, 2, "row persisted (no transaction)")
    assert.equal(((await svc.list("me")) as Thing[]).length, 2)
    assert.equal(((await parent.list("me")) as Thing[]).length, 2)
  })

  it("#3 a failure before the write does not invalidate", async () => {
    const { thing, db, resource } = setup({ listMode: "all", listCache: { scope: "things" } })
    thing.rows.push({ id: 1, orgId: "me", name: "a" })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeCreate(): never {
        throw new ForbiddenException("no")
      }
    }
    const svc = new Svc(db, resource, new OrgListCache())
    assert.equal(((await svc.list("me")) as Thing[]).length, 1)
    thing.rows.push({ id: 2, orgId: "me", name: "b" })
    await assert.rejects(() => svc.create("me", { name: "c" }), ForbiddenException)
    assert.equal(((await svc.list("me")) as Thing[]).length, 1, "still cached")
  })

  function quietLogger() {
    const errors: string[] = []
    const logger = new Logger("test")
    logger.error = ((msg: string) => {
      errors.push(msg)
    }) as Logger["error"]
    return { errors, logger }
  }

  it("#5 afterCommit runs after the transaction commits, after afterWrite/after* hooks", async () => {
    const { db, log, resource } = setup({ transactional: true })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeCreate(dto: CreateThing, ctx: CreateContext<Thing>) {
        ctx.afterCommit((row) => {
          log.push(`commit:${row.name}`)
        })
        ctx.afterWrite(() => {
          log.push("afterWrite")
        })
        return { ...dto }
      }
      protected override afterCreate(row: Thing, ctx: CreateContext<Thing>) {
        log.push("after")
        ctx.afterCommit(() => {
          log.push("commit:2")
        })
      }
    }
    await new Svc(db, resource).create("me", { name: "x" })
    assert.deepEqual(log, ["tx:begin", "afterWrite", "after", "tx:commit", "commit:x", "commit:2"])
  })

  it("#5 afterCommit never runs on rollback", async () => {
    const { thing, db, log, resource } = setup({ transactional: true })
    db.$transaction = async <R>(fn: (tx: unknown) => Promise<R>) => {
      log.push("tx:begin")
      const snapshot = [...thing.rows]
      try {
        return await fn({ thing, marker: "tx" })
      } catch (e) {
        thing.rows.splice(0, thing.rows.length, ...snapshot)
        log.push("tx:rollback")
        throw e
      }
    }
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override afterCreate(_row: Thing, ctx: CreateContext<Thing>): never {
        ctx.afterCommit(() => {
          log.push("commit")
        })
        throw new ForbiddenException("nope")
      }
    }
    await assert.rejects(() => new Svc(db, resource).create("me", { name: "x" }), ForbiddenException)
    assert.deepEqual(log, ["tx:begin", "tx:rollback"])
    assert.equal(thing.rows.length, 0)
  })

  it("#5 afterCommit errors are logged, not thrown; later callbacks still run", async () => {
    const { db, resource } = setup()
    const { errors, logger } = quietLogger()
    const ran: string[] = []
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override readonly afterCommitLogger = logger
      protected override afterCreate(_row: Thing, ctx: CreateContext<Thing>) {
        ctx.afterCommit(async () => {
          throw new Error("smtp down")
        })
        ctx.afterCommit(() => {
          ran.push("second")
        })
      }
    }
    const row = (await new Svc(db, resource).create("me", { name: "x" })) as Thing
    assert.equal(row.name, "x")
    assert.deepEqual(ran, ["second"])
    assert.equal(errors.length, 1)
    assert.match(errors[0] ?? "", /afterCommit callback failed \(thing create\): smtp down/)
  })

  it("#5 non-transactional: afterCommit runs right after the write; still runs if a later hook throws", async () => {
    const { thing, db, resource } = setup()
    const ran: string[] = []
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeUpdate(dto: { name?: string }, ctx: UpdateContext<Thing>) {
        ctx.afterCommit((row) => {
          ran.push(`commit:${row.name}`)
        })
        return { ...dto }
      }
      protected override afterUpdate(): never {
        throw new Error("late hook")
      }
    }
    thing.rows.push({ id: 1, orgId: "me", name: "a" })
    await assert.rejects(() => new Svc(db, resource).update("me", 1, { name: "b" }), /late hook/)
    assert.deepEqual(ran, ["commit:b"])
  })

  it("#5 afterCommit works on destroy and approval too", async () => {
    const { thing, db, resource } = setup({ transactional: true })
    thing.rows.push({ id: 1, orgId: "me", name: "a", approvalStatus: "pending" })
    const ran: string[] = []
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeApproval(ctx: Parameters<OrgResourceService<{ row: Thing }>["beforeApproval"]>[0]) {
        ctx.afterCommit((row) => {
          ran.push(`approval:${(row as Thing).approvalStatus}`)
        })
      }
      protected override beforeDestroy(ctx: Parameters<OrgResourceService<{ row: Thing }>["beforeDestroy"]>[0]) {
        ctx.afterCommit((row) => {
          ran.push(`destroy:${(row as Thing).id}`)
        })
      }
    }
    const svc = new Svc(db, resource)
    await svc.updateApproval("me", 1, { approvalStatus: "approved" }, admin)
    await svc.destroy("me", 1)
    assert.deepEqual(ran, ["approval:approved", "destroy:1"])
  })

  it("#6 resource.unique: exact match + fields in the 409 body", async () => {
    const { db, resource } = setup({
      unique: { messages: { name: "Name already exists", displayName: "Display name already exists" } },
    })
    class Svc extends OrgResourceService<{ row: Thing }> {
      protected override beforeCreate(): never {
        throw prismaAdapterUniqueError(["orgId", "displayName"], "things_orgId_displayName_key")
      }
    }
    await assert.rejects(
      () => new Svc(db, resource).create("me", { name: "x" }),
      (e: unknown) =>
        e instanceof ConflictException &&
        e.message === "Display name already exists" &&
        JSON.stringify(e.getResponse()) ===
          JSON.stringify({ statusCode: 409, message: "Display name already exists", error: "Conflict", fields: ["displayName"] }),
    )
  })

  it("#7 numberRange with string query values (no DTO) works; garbage → 400", async () => {
    const { thing, db, resource } = setup()
    thing.rows.push({ id: 1, orgId: "me", name: "a", price: 5 })
    thing.rows.push({ id: 2, orgId: "me", name: "b", price: 50 })
    const svc = new OrgResourceService<{ row: Thing }>(db, resource)
    const res = (await svc.list("me", { minPrice: "10" })) as { data: Thing[] }
    assert.deepEqual(res.data.map((r) => r.id), [2])
    await assert.rejects(() => svc.list("me", { minPrice: "ten" }), BadRequestException)
  })
})
