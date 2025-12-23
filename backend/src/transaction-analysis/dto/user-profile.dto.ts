import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  incomeStability?: string

  @ApiPropertyOptional()
  debtToIncomeRatio?: number

  @ApiPropertyOptional()
  spendingBehavior?: string

  @ApiPropertyOptional()
  riskScore?: number

  @ApiPropertyOptional()
  fraudScore?: number

  @ApiPropertyOptional()
  monthlyIncome?: number

  @ApiPropertyOptional()
  monthlyExpenses?: number
}
export class UserProfileResponseDto extends UpdateUserProfileDto {
  @ApiProperty()
  userId: string
}


export class ProfileInsightsDto {
  @ApiProperty()
  userId: string

  @ApiProperty({ type: [String] })
  insights: string[]

  @ApiProperty({ type: [String] })
  recommendations: string[]

  @ApiPropertyOptional()
  healthScore?: number
}