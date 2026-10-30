import { Type } from "class-transformer"
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator"
import { SortQueryDto } from "../query/pagination.js"

/**
 * Shared Find* query for trade docs (quotes / orders / BL / invoices / returns).
 *
 * @deprecated Declare a per-resource Find*QueryDto in the app.
 */
export class TradeListQueryDto extends SortQueryDto {
  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @IsIn(["sell", "buy"])
  type?: "sell" | "buy"

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  companyId?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minTotalAmount?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxTotalAmount?: number

  @IsOptional()
  @IsString()
  createdAtFrom?: string

  @IsOptional()
  @IsString()
  createdAtTo?: string

  @IsOptional()
  @IsString()
  orgId?: string
}

/** Shared line item shape — math stays in @plumo/money. *
 * @deprecated Declare line-item DTOs in the app.
 */
export class CreateTradeLineItemDto {
  @Type(() => Number)
  @IsNumber()
  productId!: number

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRatePercent?: number
}

export class UpdateApprovalDto {
  @IsIn(["pending", "approved", "rejected"])
  approvalStatus!: "pending" | "approved" | "rejected"
}
