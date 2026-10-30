import { Inject, Injectable, Optional } from "@nestjs/common"

const DEFAULT_TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 500

export type OrgListCacheOptions = {
  ttlMs?: number
}

/** Optional DI token: `{ provide: ORG_LIST_CACHE_CONFIG, useValue: {...} }`. */
export const ORG_LIST_CACHE_CONFIG = Symbol("ORG_LIST_CACHE_CONFIG")

export type OrgListCacheConfig = {
  /** Default TTL for every scope (5 min). Per-resource `ttlMs` still wins. */
  defaultTtlMs?: number
  /** Max entries before LRU eviction (500). */
  maxEntries?: number
  /** `false` turns the cache into a pass-through (e.g. >1 API instance). */
  enabled?: boolean
}

/**
 * In-memory org-scoped list cache.
 * Opt-in via defineResource({ listCache: { scope } }) — CUD auto-invalidates.
 *
 * PER PROCESS: with more than one API instance, other replicas keep serving
 * their own copy until TTL expiry. Run a single instance, use a short TTL, or
 * construct it with `{ enabled: false }`.
 */
@Injectable()
export class OrgListCache {
  private readonly store = new Map<
    string,
    { expiresAt: number; value: unknown }
  >()
  /** scope → scopes whose cached lists embed it (e.g. categories → brands). */
  private readonly dependents = new Map<string, Set<string>>()
  private readonly defaultTtlMs: number
  private readonly maxEntries: number
  private readonly enabled: boolean

  constructor(
    @Optional()
    @Inject(ORG_LIST_CACHE_CONFIG)
    config: OrgListCacheConfig = {},
  ) {
    this.defaultTtlMs = config.defaultTtlMs ?? DEFAULT_TTL_MS
    this.maxEntries = config.maxEntries ?? MAX_ENTRIES
    this.enabled = config.enabled ?? true
  }

  /**
   * Declare that lists cached under `scope` embed rows of `dependsOn`
   * scopes, so invalidating any of those also clears `scope`.
   */
  registerDependencies(scope: string, dependsOn: readonly string[]) {
    for (const parent of dependsOn) {
      const set = this.dependents.get(parent) ?? new Set<string>()
      set.add(scope)
      this.dependents.set(parent, set)
    }
  }

  async getOrSet<T>(
    scope: string,
    orgId: string,
    variant: unknown,
    load: () => Promise<T>,
    options: OrgListCacheOptions = {},
  ): Promise<T> {
    if (!this.enabled) return load()
    const ttlMs = options.ttlMs ?? this.defaultTtlMs
    const key = this.key(scope, orgId, variant)
    const hit = this.store.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      this.store.delete(key)
      this.store.set(key, hit)
      return hit.value as T
    }
    const value = await load()
    this.set(key, value, ttlMs)
    return value
  }

  /** Clears `scope` for `orgId`, plus every scope that depends on it. */
  invalidate(scope: string, orgId: string, seen = new Set<string>()) {
    if (seen.has(scope)) return
    seen.add(scope)
    const prefix = `${scope}:${orgId}:`
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
    for (const dependent of this.dependents.get(scope) ?? []) {
      this.invalidate(dependent, orgId, seen)
    }
  }

  private set(key: string, value: unknown, ttlMs: number) {
    this.store.delete(key)
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
    this.evict()
  }

  private evict() {
    const now = Date.now()
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k)
    }
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  private key(scope: string, orgId: string, variant: unknown) {
    return `${scope}:${orgId}:${stableJson(variant)}`
  }
}

/** Optional singleton when Nest DI is not used. */
export const defaultOrgListCache = new OrgListCache()

function stableJson(value: unknown): string {
  if (value == null) return ""
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }
  if (typeof value !== "object") return ""
  if (Array.isArray(value)) return JSON.stringify(value)
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return ""
  return JSON.stringify(Object.fromEntries(entries))
}
