/**
 * Compile-time contract for OrgResourceService generics. Checked by
 * `pnpm typecheck` (not bundled, not executed).
 */
import type { Actor } from "../core/types.js"
import { defineResource } from "../resource/resource.js"
import type { CreateContext, UpdateContext } from "./context.js"
import { OrgResourceService } from "./org-resource.service.js"

type Product = { id: number; orgId: string; name: string; price: number }
type CreateProduct = { name: string; price: number }
type UpdateProduct = Partial<CreateProduct>
type ProductOut = Product & { priceLabel: string }

const products = defineResource<Product>({
  model: "product",
  sortable: ["name", "price"],
})
void products

defineResource<Product>({
  model: "product",
  // @ts-expect-error — unknown field
  sortable: ["nope"],
})

class ProductsService extends OrgResourceService<{
  row: Product
  create: CreateProduct
  update: UpdateProduct
  output: ProductOut
}> {
  protected override beforeCreate(dto: CreateProduct, ctx: CreateContext<Product>) {
    const orgId: string = ctx.orgId
    void orgId
    return { ...dto, name: dto.name.trim() }
  }
  protected override beforeUpdate(dto: UpdateProduct, ctx: UpdateContext<Product>) {
    const price: number = ctx.existing.price
    return { ...dto, price: dto.price ?? price }
  }
  protected override presentOne(row: Product): ProductOut {
    return { ...row, priceLabel: `${row.price}` }
  }
}

declare const svc: ProductsService
declare const actor: Actor

async function contract() {
  const out: ProductOut = await svc.retrieve("o", 1)
  const created: ProductOut = await svc.create("o", { name: "a", price: 1 }, actor)
  const updated: ProductOut = await svc.update("o", 1, { price: 2 }, actor)
  // @ts-expect-error — create DTO is enforced
  await svc.create("o", { name: 1 }, actor)
  // @ts-expect-error — update DTO is enforced
  await svc.update("o", 1, { nope: true }, actor)
  void out
  void created
  void updated
}
void contract
