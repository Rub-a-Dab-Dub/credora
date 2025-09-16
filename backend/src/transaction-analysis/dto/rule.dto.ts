import { ApiProperty } from "@nestjs/swagger"
import { RuleType, RuleStatus } from "../entities/analysis-rule.entity"

export class CreateRuleDto {
  @ApiProperty()
  name: string

  @ApiProperty({ required: false })
  description?: string

  @ApiProperty({ enum: RuleType })
  ruleType: RuleType

  @ApiProperty({ enum: RuleStatus, required: false })
  status?: RuleStatus

  @ApiProperty({ type: 'array', description: 'conditions as JSON object or array' })
  conditions: any

  @ApiProperty({ required: false, description: 'actions' })
  actions: any

  @ApiProperty({ required: false })
  priority?: number
}

export class UpdateRuleDto {
  @ApiProperty({ required: false })
  name?: string

  @ApiProperty({ enum: RuleType, required: false })
  type?: RuleType

  @ApiProperty({ required: false })
  conditions?: Record<string, any>

  @ApiProperty({ required: false })
  actions?: Record<string, any>

  @ApiProperty({ enum: RuleStatus, required: false })
  status?: RuleStatus
}

export class RuleTestDto {
  @ApiProperty()
  transactionId: string
  includeHistorical?: boolean
  timeRangeMonths?: number
}
export type AnalysisRule = {
  id: string
  name: string
  description?: string
  ruleType: RuleType
  status: RuleStatus
  conditions: any
  actions: any
  priority?: number
  threshold?: number
  version?: string
  createdBy?: string
  updatedBy?: string
  createdAt?: Date
  updatedAt?: Date
}
export const EXAMPLE_RULES = [
  {
    name: "High Value Transaction Alert",
    ruleType: RuleType.CASH_FLOW,
    conditions: { amount: { $gt: 1000 } },
    actions: { flag: true, alert: "High value transaction" },
    priority: 10,
    status: RuleStatus.ACTIVE,
  },
  {
    name: "Unusual Merchant Category",
    ruleType: RuleType.CATEGORIZATION,
    conditions: { merchantCategory: { $in: ["gambling", "crypto"] } },
    actions: { flag: true, alert: "Unusual spending category" },
    priority: 5,
    status: RuleStatus.INACTIVE,
  }
]