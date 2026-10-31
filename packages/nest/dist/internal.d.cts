import { M as ModelDelegate, O as OrgRow } from './unique-CbQBBGrc.cjs';
export { w as delegateOf, C as prismaAdapterUniqueError, J as prismaUniqueError, _ as resolveOrderRaw, Y as runStrategies, Z as strategiesFor } from './unique-CbQBBGrc.cjs';

/** Prisma P2025-shaped error (record to update/delete not found). */
declare function recordNotFound(): Error & {
    code: string;
};
/** In-memory ModelDelegate for unit tests (exported from `@plumo/nest/internal`). */
declare function createMockDelegate(): ModelDelegate & {
    rows: OrgRow[];
};

export { createMockDelegate, recordNotFound };
