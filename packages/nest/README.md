# `@plumo/nest`

DRF-like Nest kit for **org-scoped** Prisma CRUD: declare a resource, inherit list/CRUD, write only domain extras.

Preview / design reference: `OutBoxSystem/test-1` (`PLUMO_NEST_PLAN.md`, `src/plumo-nest`).

## Install

```bash
pnpm add @plumo/nest
# peers: @nestjs/common class-validator class-transformer reflect-metadata
```

Domain math stays in separate packages — import them from your services:

- `@plumo/money`
- `@plumo/stock`
- `@plumo/company-finance`

## Quick start

```ts
import {
  defineResource,
  Filter,
  OrgCrudService,
  OrgCrudController,
  OrgListCache,
} from '@plumo/nest'

export const contactResource = defineResource({
  model: 'contact',
  search: ['firstName', 'lastName', 'email'],
  filters: { email: Filter.exact() },
  sortable: ['createdAt', 'firstName'],
  defaultOrder: { createdAt: 'desc' },
})

@Injectable()
export class ContactsService extends OrgCrudService {
  constructor(prisma: PrismaService, cache: OrgListCache) {
    super(prisma, contactResource, cache)
  }
}

@Controller('contacts')
export class ContactsController extends OrgCrudController {
  constructor(protected readonly service: ContactsService) {
    super()
  }
}
```

List response shape: `{ data, pagination }` (`page`, `limit`, `total`, `totalPages`).

## Surface

| API | Role |
|-----|------|
| `defineResource` / `Filter.*` | Declarative where + search + sort |
| `OrgCrudService` / `OrgCrudController` | Org-scoped ViewSet |
| `requireInOrg` / `requireAllRelatedInOrg` | FK membership |
| `approvalOnCreate` / `applyApprovalUpdate` / `runApprovalUpdate` | Approvals |
| `OrgNestedCrudService` | Parent → child CRUD |
| `mapPrismaUnique` | P2002 → field-specific `ConflictException` |
| `OrgListCache` + `listCache` on resource | Opt-in list cache; invalidate on CUD |
| `TradeListQueryDto` / `CreateTradeLineItemDto` | Shared trade Find / line DTOs |
| `findManyPaginated` | Low-level paginated findMany |

Opt-in list cache + unpaginated catalog lists:

```ts
defineResource({
  model: 'category',
  listMode: 'all', // full array instead of { data, pagination }
  listCache: { scope: 'categories', ttlMs: 60_000 },
})
```

`OrgCrudController` reads the org **only** from `req.auth.orgId` (set by the app's auth guard from the verified Clerk token) and throws `403 Active organization is required` when it is missing. A client `?orgId=` is stripped and never used. Override a single handler when permissions differ (e.g. looser `findAll`).

Unique conflict in convert/create:

```ts
} catch (error) {
  mapPrismaUnique(error, {
    quoteId: 'Une commande existe déjà pour ce devis.',
    orderNumber: 'Impossible de générer un numéro de commande unique.',
  })
  throw error
}
```

## DRF cheat sheet

| DRF | `@plumo/nest` |
|-----|----------------|
| `ModelViewSet` | `OrgCrudService` |
| django-filter | `defineResource({ filters })` |
| `search_fields` | `search` → `?q=` |
| Nested routers | `OrgNestedCrudService` |
| `@action` | Extra service methods + hand controller routes |

## Scripts

```bash
pnpm --filter @plumo/nest test
pnpm --filter @plumo/nest typecheck
pnpm --filter @plumo/nest build
```

## Out of scope

Convert/POS/payment locks, Clerk auth, document numbering, soft deletes, and money/stock/finance math (use the domain packages).
