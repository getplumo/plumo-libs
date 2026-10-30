import {
  delegateOf,
  prismaAdapterUniqueError,
  prismaUniqueError,
  resolveOrder,
  runStrategies,
  strategiesFor
} from "./chunk-JH4URFFP.js";

// src/internal.ts
import "reflect-metadata";

// src/testing/mock-delegate.ts
function recordNotFound() {
  const err = new Error("Record to update not found.");
  err.code = "P2025";
  return err;
}
function createMockDelegate() {
  const rows = [];
  let seq = 1;
  function match(row, where) {
    for (const [key, condition] of Object.entries(where)) {
      if (key === "AND" && Array.isArray(condition)) {
        if (!condition.every((c) => match(row, c))) {
          return false;
        }
        continue;
      }
      if (key === "OR" && Array.isArray(condition)) {
        if (!condition.some((c) => match(row, c))) {
          return false;
        }
        continue;
      }
      if (condition === null) {
        if (row[key] != null) return false;
        continue;
      }
      if (condition && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof Date)) {
        const c = condition;
        if ("in" in c && Array.isArray(c.in)) {
          if (!c.in.includes(row[key])) return false;
          continue;
        }
        if ("contains" in c) {
          if (!String(row[key] ?? "").toLowerCase().includes(String(c.contains).toLowerCase())) {
            return false;
          }
          continue;
        }
        if ("gte" in c || "lte" in c) {
          const num = Number(row[key]);
          if (c.gte !== void 0 && !(num >= Number(c.gte))) return false;
          if (c.lte !== void 0 && !(num <= Number(c.lte))) return false;
          continue;
        }
      }
      if (row[key] !== condition) return false;
    }
    return true;
  }
  const delegate = {
    rows,
    async findFirst({ where }) {
      return rows.find((r) => match(r, where)) ?? null;
    },
    async findMany({ where, skip = 0, take }) {
      let list = rows.filter((r) => match(r, where ?? {}));
      list = list.slice(skip, take !== void 0 ? skip + take : void 0);
      return list;
    },
    async count({ where }) {
      return rows.filter((r) => match(r, where ?? {})).length;
    },
    async create({ data }) {
      const row = {
        id: seq++,
        createdAt: /* @__PURE__ */ new Date(),
        ...data
      };
      rows.push(row);
      return row;
    },
    async update({ where, data }) {
      const row = rows.find((r) => match(r, where));
      if (!row) throw recordNotFound();
      Object.assign(row, data);
      return row;
    },
    async delete({ where }) {
      const idx = rows.findIndex((r) => match(r, where));
      if (idx < 0) throw recordNotFound();
      const [row] = rows.splice(idx, 1);
      return row;
    }
  };
  return delegate;
}
export {
  createMockDelegate,
  delegateOf,
  prismaAdapterUniqueError,
  prismaUniqueError,
  recordNotFound,
  resolveOrder as resolveOrderRaw,
  runStrategies,
  strategiesFor
};
