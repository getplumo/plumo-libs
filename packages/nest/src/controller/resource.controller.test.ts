import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  RequestMethod,
  SetMetadata,
  ValidationPipe,
} from "@nestjs/common"
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants.js"
import { IsOptional, IsString } from "class-validator"
import {
  OrgResourceController,
  type ResourceServiceLike,
} from "./resource.controller.js"

// Decorators applied by hand: tsx does not enable legacy decorators for
// test files (they are excluded from tsconfig).
class CreateDto {
  name!: string
}
IsString()(CreateDto.prototype, "name")
class UpdateDto {
  name?: string
}
IsOptional()(UpdateDto.prototype, "name")
IsString()(UpdateDto.prototype, "name")
class QueryDto {
  search?: string
}
IsOptional()(QueryDto.prototype, "search")
IsString()(QueryDto.prototype, "search")

function fakeService() {
  const calls: unknown[][] = []
  const svc: ResourceServiceLike = {
    list: (...a) => calls.push(["list", ...a]),
    retrieve: (...a) => calls.push(["retrieve", ...a]),
    create: (...a) => calls.push(["create", ...a]),
    update: (...a) => calls.push(["update", ...a]),
    destroy: (...a) => calls.push(["destroy", ...a]),
    updateApproval: (...a) => calls.push(["approval", ...a]),
  }
  return { svc, calls }
}

const ROLE = "role"

class ThingsController extends OrgResourceController({
  create: CreateDto,
  update: UpdateDto,
  query: QueryDto,
  decorators: [SetMetadata(ROLE, "all")],
  routes: { list: { decorators: [SetMetadata("extra", true)] }, destroy: false },
}) {
  constructor(readonly service: ResourceServiceLike) {
    super()
  }
  lowStock() {
    return "static"
  }
}
Get("low-stock")(
  ThingsController.prototype,
  "lowStock",
  Object.getOwnPropertyDescriptor(ThingsController.prototype, "lowStock")!,
)
Controller("things")(ThingsController)

const proto = ThingsController.prototype as unknown as Record<string, Function>

describe("OrgResourceController factory", () => {
  it("registers verbs/paths with the 0.1 method names", () => {
    const route = (k: string) => [
      Reflect.getMetadata(METHOD_METADATA, proto[k]!),
      Reflect.getMetadata(PATH_METADATA, proto[k]!),
    ]
    assert.deepEqual(route("findAll"), [RequestMethod.GET, "/"])
    assert.deepEqual(route("findOne"), [RequestMethod.GET, ":id"])
    assert.deepEqual(route("create"), [RequestMethod.POST, "/"])
    assert.deepEqual(route("update"), [RequestMethod.PATCH, ":id"])
    assert.equal(proto.remove, undefined, "destroy: false removes the route")
    assert.equal(proto.updateApproval, undefined, "approval is opt-in")
  })

  it("subclass routes come before generated :id routes (scan order)", () => {
    const own = Object.getOwnPropertyNames(ThingsController.prototype)
    assert.ok(own.includes("lowStock"))
    assert.ok(!own.includes("findOne"), "generated routes live on the base prototype")
  })

  it("applies global + per-route decorators", () => {
    assert.equal(Reflect.getMetadata(ROLE, proto.create!), "all")
    assert.equal(Reflect.getMetadata("extra", proto.findAll!), true)
    assert.equal(Reflect.getMetadata("extra", proto.create!), undefined)
  })

  it("design:paramtypes carry the DTOs → ValidationPipe whitelists", async () => {
    const types = Reflect.getMetadata("design:paramtypes", proto, "create")
    assert.deepEqual(types, [String, Object, CreateDto])
    assert.deepEqual(Reflect.getMetadata("design:paramtypes", proto, "update"), [
      String,
      Object,
      Number,
      UpdateDto,
    ])
    assert.equal(Reflect.getMetadata("design:paramtypes", proto, "findAll")[2], QueryDto)

    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    await assert.rejects(
      () => pipe.transform({ name: "a", orgId: "evil" }, { type: "body", metatype: CreateDto }),
      BadRequestException,
    )
    const ok = await pipe.transform({ name: "a" }, { type: "body", metatype: CreateDto })
    assert.ok(ok instanceof CreateDto)
  })

  it("binds org/actor/id/body params at the expected indexes", () => {
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, ThingsController, "update") as Record<
      string,
      { index: number; data?: string; pipes?: unknown[] }
    >
    const byIndex = Object.values(args).sort((a, b) => a.index - b.index)
    assert.deepEqual(byIndex.map((a) => a.index), [0, 1, 2, 3])
    assert.equal(byIndex[2]?.data, "id")
    assert.equal(byIndex[2]?.pipes?.length, 1, "ParseIntPipe by default")
  })

  it("handlers forward orgId from the token, strip query.orgId, pass the actor", async () => {
    const { svc, calls } = fakeService()
    const c = new ThingsController(svc) as unknown as Record<string, Function>
    const actor = { userId: "u", orgRole: "org:admin" }
    c.findAll!.call(c, "org_a", actor, { orgId: "org_b", search: "x" })
    c.create!.call(c, "org_a", actor, Object.assign(new CreateDto(), { name: "n" }))
    c.update!.call(c, "org_a", actor, 5, { name: "m" })
    assert.deepEqual(calls, [
      ["list", "org_a", { search: "x" }],
      ["create", "org_a", { name: "n" }, actor],
      ["update", "org_a", 5, { name: "m" }, actor],
    ])
  })

  it("id: 'number' uses no pipe and coerces with +id; onRequest runs first", () => {
    const seen: string[] = []
    class Legacy extends OrgResourceController({
      id: "number",
      approval: UpdateDto,
      onRequest: ({ route, actor }) => {
        seen.push(route)
        if (actor.orgRole === "cashier") throw new ForbiddenException("no")
      },
    }) {
      constructor(readonly service: ResourceServiceLike) {
        super()
      }
    }
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Legacy, "findOne") as Record<
      string,
      { index: number; pipes?: unknown[] }
    >
    const idArg = Object.values(args).find((a) => a.index === 2)
    assert.equal(idArg?.pipes?.length, 0)
    const { svc, calls } = fakeService()
    const c = new Legacy(svc) as unknown as Record<string, Function>
    c.findOne!.call(c, "o", {}, "7")
    c.updateApproval!.call(c, "o", {}, "7", { approvalStatus: "approved" })
    assert.deepEqual(calls[0], ["retrieve", "o", 7])
    assert.equal(calls[1]?.[0], "approval")
    assert.throws(() => c.remove!.call(c, "o", { orgRole: "cashier" }, "1"), ForbiddenException)
    assert.deepEqual(seen, ["retrieve", "approval", "destroy"])
  })

  it("two factories do not share handler metadata", () => {
    const A = OrgResourceController({ decorators: [SetMetadata("who", "A")] })
    const B = OrgResourceController({ decorators: [SetMetadata("who", "B")] })
    const a = (A.prototype as unknown as Record<string, Function>).create!
    const b = (B.prototype as unknown as Record<string, Function>).create!
    assert.notEqual(a, b)
    assert.equal(Reflect.getMetadata("who", a), "A")
    assert.equal(Reflect.getMetadata("who", b), "B")
  })
})
