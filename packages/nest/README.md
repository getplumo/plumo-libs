# `@plumo/nest` 0.2.1

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
| `updateApproval(orgId, id, { approvalStatus }, actor)` | 400 unless `pending`/`approved`/`rejected` (even without a DTO), manager/admin only (403), no-op when unchanged |

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
resource is `transactional: true`), `afterWrite(fn)` and `afterCommit(fn)`.

### `afterWrite` vs `afterCommit`

| | `ctx.afterWrite(fn)` | `ctx.afterCommit(fn)` |
|---|---|---|
| When | right after the row is written, **before** `after*` hooks | once the write is **durable**: after `$transaction` commits (`transactional: true`), or after the write + hooks otherwise |
| Transaction | inside it (use `ctx.tx`) | outside it (use `this.db`; `ctx.tx` is closed) |
| On rollback | rolled back with everything else | **never runs** |
| If it throws | the write fails (rolled back when transactional) and the client gets the error | error is **logged** (`Logger`, context = service class) and swallowed — the client still gets the success response |
| Use for | stock moves, side tables, anything that must be atomic with the row | audit logs, notifications, e-mails, webhooks, outbox kicks |

```ts
protected afterApproval(row: Invoice, ctx: ApprovalContext<Invoice>) {
  ctx.afterCommit(() => this.audit.log('invoice.approval', row.id, ctx.change))
}
```

Details: callbacks may be registered from any `before*`/`after*` hook; they
run in registration order, are awaited (after the list cache is invalidated,
before the response is returned) and receive the written row (before
`presentOne`). On a non-transactional resource, if a hook throws after the row
was written, the row stays persisted, so callbacks registered so far still run
and the list cache is still invalidated, then the hook's error is returned.
Override `afterCommitLogger` to plug your own logger. `afterWrite` semantics
are unchanged from 0.2.0.

Helpers for subclasses: `findOrFail(orgId, id, action?)`,
`mapWriteError(error, action)`, `checkRelations`, `invalidateListCache`.

## Resource options

`model`, `notFoundMessage`, `search`, `searchParam`, `filters`, `sortable`,
`sortDirectionParam` (e.g. legacy `sortOrder`), `defaultOrder`, `include`,
`includeOn` (`{ retrieve, create, update, approval, destroy }`), `listInclude`
/ `listSelect`, `listCache`, `listMode` (`paginated` | `all`), `transactional`,
`unique`, `relations`, `softDelete`, `searchCaseInsensitive`.

- `searchCaseInsensitive` (default `true`): adds Prisma `mode: 'insensitive'`
  to search (`contains`). That mode is PostgreSQL/MongoDB only — set `false`
  on MySQL/SQLite/SQL Server (matching then follows the column collation).
- `unique.messages`: keys are matched **exactly** — a column (`'code'`), a
  comma-separated column set that must all conflict (`'orgId,code'`), or the
  exact constraint/index name (`'products_orgId_code_key'`). No substring
  matching (`name` does not match `displayName`). When the error only names
  an index (partial unique index on adapters) its `_`-separated tokens are
  compared whole. The 409 body keeps `statusCode`/`message`/`error` and adds
  `fields: string[]` (conflicting columns without `orgId`):
  `{ "statusCode": 409, "message": "Code already exists", "error": "Conflict", "fields": ["code"] }`.

### Filters

| Filter | Query → where | Invalid input |
|---|---|---|
| `Filter.exact()` / `exact('key')` | `?brandId=3` → `{ brandId: '3' }` (raw value; rely on a transforming DTO) | — |
| `Filter.exact({ key?, type })` / `exact('key', type)` | coerced: `type: 'int' \| 'number' \| 'boolean' \| 'date' \| 'string'` → `{ brandId: 3 }` | 400 |
| `Filter.numberRange(min, max, { type?: 'number' \| 'int' })` | always coerced to numbers → `{ gte, lte }` | 400 (also min > max) |
| `Filter.dateRange(from, to)` | UTC day bounds | 400 |
| `Filter.inList()` / `inList({ key?, type? })` | `?status=a,b` → `{ in: [...] }` (items coerced when `type` is set) | 400 |
| `Filter.custom(fn)` | anything | — |

Booleans accept `true`/`false`/`1`/`0`. `coerceFilterValue(value, type,
label)` is exported for custom filters.

The list pipeline is exported too: `strategiesFor(resource)`,
`runStrategies(strategies, orgId, query)`, `QueryStrategies.*`,
`buildListWhere`, `planList`.

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
