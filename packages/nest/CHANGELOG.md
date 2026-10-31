# Changelog — `@plumo/nest`

## 0.2.1 — 2026-10-31

Bug fixes (no breaking changes to the public API; see notes on behaviour):

1. **dateRange filter**: an invalid date (`?createdAtFrom=nope`) now returns
   **400** (`BadRequestException`) instead of a Prisma 500.
2. **updateApproval**: an unknown or missing `approvalStatus` now returns
   **400**, even when the controller has no approval DTO. Only `pending`,
   `approved` and `rejected` are accepted (`buildApprovalStatusPatch` also
   validates). New exports: `APPROVAL_STATUSES`, `isApprovalStatus`,
   `assertApprovalStatus`.
3. **List cache on non-transactional resources**: when an `after*` hook /
   `afterWrite` callback throws after the row was written, the list cache (and
   its `dependsOn` dependants) is now still invalidated.
4. **Search case-insensitivity is configurable**: new resource option
   `searchCaseInsensitive` (default `true` = previous Postgres behaviour; set
   `false` for MySQL/SQLite/SQL Server). `applySearch(where, fields, q,
   insensitive?)` and `QueryStrategies.search(fields, param?, insensitive?)`
   take the flag. `strategiesFor` and `runStrategies` are now exported.
5. **New `ctx.afterCommit(fn)`**: runs only once the write is durable (after
   the transaction commits; after the write + hooks for non-transactional
   resources), never on rollback. Errors are logged and swallowed, never sent
   to the client. Intended for audit logs / notifications. `afterWrite` is
   unchanged (inside the transaction). See README "afterWrite vs afterCommit".
6. **P2002 → 409 mapping matches exactly**: `unique.messages` keys and
   `prismaUniqueIncludes` match a column exactly, a comma-separated column set,
   or the exact constraint name — no more substring matches (`name` no longer
   matches `displayName`). The 409 body keeps `statusCode`, `message` and
   `error` and adds `fields: string[]`. New exports: `prismaUniqueColumns`,
   `prismaUniqueConstraints`, `prismaUniqueMatches`, type `UniqueConflictBody`.
7. **Typed filters without a DTO**: `Filter.numberRange` always coerces query
   strings to numbers (400 on garbage, optional `{ type: 'int' }`);
   `Filter.exact` / `Filter.inList` accept a declared `type`
   (`'string' | 'number' | 'int' | 'boolean' | 'date'`) and coerce/validate
   (400 on invalid input). Untyped `Filter.exact()` keeps passing the raw value.
   New export: `coerceFilterValue`.

Behaviour notes: a `unique.messages` key that relied on substring matching of
a constraint name (e.g. `'quote'` for `orders_orgId_quoteId_key`) must now be
the exact column (`'quoteId'`) or constraint name. `numberRange` with an empty
bound (`?minPrice=`) no longer writes an empty `{}` condition.

## 0.2.0

Typed `OrgResourceService` / `OrgResourceController`, resource definitions,
query pipeline, approval workflow, Prisma 7 adapter-aware P2002 mapping.
