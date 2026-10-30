# `@plumo/nest` 0.2

DRF-style NestJS kit for **org-scoped** Prisma CRUD. You describe a resource
in a few lines, extend one typed service and one generated controller, and
write only the business rules as hooks.

```
src/
  core/        Actor, delegate types, decimal helpers
  resource/    defineResource() — the declarative resource definition
  query/       filters (Filter.*), search, ordering, pagination, list pipeline
  service/     OrgResourceService (typed hooks), OrgNestedCrudService, contexts
  controller/  OrgResourceController({...}) — generated REST routes
  tenancy/     @CurrentOrgId / @CurrentActor, requireInOrg helpers
  approval/    approval workflow (approvalOnCreate, buildApprovalStatusPatch)
  prisma/      P2002 → 409 mapping that works with Prisma 7 driver adapters
  cache/       OrgListCache (per-org list cache)
  legacy/      0.1 API (OrgCrudService/OrgCrudController…), @deprecated
  testing/     mock delegates (exported from `@plumo/nest/internal`)
```

## A resource in three files

```ts
// contacts.resource.ts — WHAT the resource is
export const contactResource = defineResource<Contact>({
  model: 'contact',
  notFoundMessage: 'Contact not found',
  search: ['name', 'company.name'],          // ?q=  (dotted paths allowed)
  filters: { companyId: Filter.exact() },     // ?companyId=
  sortable: ['createdAt', 'name'],            // ?sortBy=&sortDirection=
  defaultOrder: { createdAt: 'desc' },
  relations: {                                // FK must belong to the org
    companyId: { model: 'company', message: 'Company not found', required: true },
  },
  unique: { messages: { email: 'Email already used' } },  // P2002 → 409
})

// contacts.service.ts — HOW it behaves (only rules, no plumbing)
@Injectable()
export class ContactsService extends OrgResourceService<{
  row: Contact
  create: CreateContactDto
  update: UpdateContactDto
}> {
  constructor(prisma: PrismaService) {
    super(prisma, contactResource)
  }

  protected beforeCreate(dto: CreateContactDto) {
    return { ...dto, email: dto.email.toLowerCase() }
  }
}

// contacts.controller.ts — the HTTP surface
@Controller('contacts')
@RequirePermissions(OrgPermission.CRM_MANAGE)
export class ContactsController extends OrgResourceController({
  create: CreateContactDto,
  update: UpdateContactDto,
  query: FindContactsQueryDto,
}) {
  constructor(readonly service: ContactsService) {
    super()
  }
  // extra routes are plain Nest methods; they are registered before `:id`
}
```

Generated routes: `POST /`, `GET /`, `GET /:id`, `PATCH /:id`,
`DELETE /:id`, and `PATCH /:id/approval` when an `approval` DTO is given.
Handler names: `create`, `findAll`, `findOne`, `update`, `remove`,
`updateApproval`.

## Service

`OrgResourceService<{ row, create?, update?, output?, listItem?, tx? }>`

| Public | Behaviour |
|---|---|
| `list(orgId, query)` | filters → search → scope → order → page; `{ data, pagination }` |
| `retrieve(orgId, id)` | 404 `notFoundMessage` when not in the org |
| `create(orgId, dto, actor?)` | relations check, hooks, P2002 mapping |
| `update(orgId, id, dto, actor?)` | loads `existing`, hooks, `where: { id, orgId }` |
| `destroy(orgId, id, actor?)` | loads `existing`, hooks |
| `updateApproval(orgId, id, { approvalStatus }, actor)` | manager/admin only, no-op when unchanged |

Hooks (all optional, all typed, sync or async):

| Hook | Use it for |
|---|---|
| `beforeCreate(dto, ctx)` → data | validation, derived fields, numbering |
| `afterCreate(row, ctx)` | caches, side tables |
| `beforeUpdate(dto, ctx{ id, existing })` → data | guards, recompute totals |
| `afterUpdate(row, ctx)` | |
| `beforeDestroy(ctx{ id, existing })` / `afterDestroy(row, ctx)` | unlink, stock reversal |
| `beforeApproval(ctx{ change: { from, to, patch } })` / `afterApproval` | re-checks, cache refresh |
| `scope(orgId, query)` → where | extra list filters that are not declarative |
| `presentOne(row, { orgId, action })` / `presentList(rows, ctx)` | response shaping |

`ctx` carries `orgId`, `actor`, `tx` (the transaction client when the
resource is `transactional: true`) and `afterWrite(fn)` to run something right
after the row is written, inside the same transaction.

Helpers for subclasses: `findOrFail(orgId, id, action?)`,
`mapWriteError(error, action)`, `checkRelations`, `invalidateListCache`.

## Resource options

`model`, `notFoundMessage`, `search`, `searchParam`, `filters`, `sortable`,
`sortDirectionParam` (e.g. legacy `sortOrder`), `defaultOrder`, `include`,
`includeOn` (`{ retrieve, create, update, approval, destroy }`), `listInclude`
/ `listSelect`, `listCache`, `listMode` (`paginated` | `all`), `transactional`,
`unique`, `relations`, `softDelete`.

Filters: `Filter.exact()`, `Filter.numberRange(min, max)`,
`Filter.dateRange(from, to)` (UTC day bounds), `Filter.inList()`,
`Filter.custom(fn)`.

## Controller options

`OrgResourceController({ create, update, query, approval, routes, decorators, id, onRequest })`

- `routes: { destroy: false }` drops a route (keys: list, retrieve, create, update, destroy, approval); `{ list: { decorators: [...] } }` adds per-route decorators.
- `id: 'int'` (default, `ParseIntPipe`) or `'number'` (legacy `+id`).
- `onRequest(ctx)` runs first in every generated handler.

## Migrating from 0.1

`OrgCrudService` / `OrgCrudController` / `findManyPaginated` /
`trade-approvable` helpers still work and are marked `@deprecated`. Move a
module by: typing the resource (`defineResource<Model>`), replacing overrides
with hooks, and swapping the controller for `OrgResourceController({...})`.
