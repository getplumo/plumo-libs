import "reflect-metadata"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  paginatedResult,
  resolvePagination,
} from "./pagination.js"

describe("resolvePagination", () => {
  it("uses defaults", () => {
    assert.deepEqual(resolvePagination({}), {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    })
  })

  it("clamps limit to MAX_LIMIT", () => {
    const r = resolvePagination({ page: 2, limit: 9999 })
    assert.equal(r.limit, MAX_LIMIT)
    assert.equal(r.skip, MAX_LIMIT)
  })

  it("floors page at 1", () => {
    assert.equal(resolvePagination({ page: 0 }).page, 1)
  })
})

describe("paginatedResult", () => {
  it("builds meta", () => {
    const r = paginatedResult([1, 2], 25, 2, 10)
    assert.deepEqual(r.pagination, {
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    })
  })
})
