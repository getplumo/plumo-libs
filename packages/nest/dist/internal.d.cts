import { M as ModelDelegate, O as OrgRow } from './unique-DxUVjgb_.cjs';
export { r as delegateOf, w as prismaAdapterUniqueError, x as prismaUniqueError, C as resolveOrderRaw, E as runStrategies, G as strategiesFor } from './unique-DxUVjgb_.cjs';

/** Prisma P2025-shaped error (record to update/delete not found). */
declare function recordNotFound(): Error & {
    code: string;
};
/** In-memory ModelDelegate for unit tests (exported from `@plumo/nest/internal`). */
declare function createMockDelegate(): ModelDelegate & {
    rows: OrgRow[];
};

export { createMockDelegate, recordNotFound };
