import {
  createParamDecorator,
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common"
import type { Actor } from "../core/types.js"

/** Shape the app's auth guard puts on `req.auth` (Clerk). */
export type AuthLike = {
  userId?: string | null
  orgId?: string | null
  orgRole?: string | null
}

function authOf(ctx: ExecutionContext): AuthLike {
  const req = ctx.switchToHttp().getRequest<{ auth?: AuthLike }>()
  if (!req.auth) {
    throw new UnauthorizedException("Missing authentication context")
  }
  return req.auth
}

/** Resolve the active org from the verified token only (never the query). */
export function orgIdFromAuth(auth: AuthLike | undefined): string {
  const orgId = auth?.orgId
  if (typeof orgId === "string" && orgId.trim()) return orgId.trim()
  throw new ForbiddenException("Active organization is required")
}

/**
 * `@CurrentOrgId()` — active organization from the token. 403 when none.
 * A client `?orgId=` / body `orgId` is never consulted.
 */
export const CurrentOrgId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => orgIdFromAuth(authOf(ctx)),
)

/** `@CurrentActor()` — `{ userId, orgRole }` from the token. */
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor => {
    const auth = authOf(ctx)
    return { userId: auth.userId ?? "", orgRole: auth.orgRole ?? null }
  },
)
