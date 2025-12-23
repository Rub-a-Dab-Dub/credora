import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AnalysisType } from '../entities/transaction-analysis.entity'

export class GetAnalysisHistoryDto {
  @ApiPropertyOptional()
  userId: string

  @ApiPropertyOptional({ enum: AnalysisType })
  analysisType?: AnalysisType

  @ApiPropertyOptional()
  limit?: number

  @ApiPropertyOptional()
  offset?: number
}


export class AnalyzeTransactionDto {
  @ApiProperty()
  transactionId: string

  @ApiPropertyOptional({ enum: AnalysisType, isArray: true })
  analysisTypes?: AnalysisType[]

  @ApiPropertyOptional()
  forceReanalysis?: boolean

  @ApiPropertyOptional()
  includeHistorical?: boolean

  @ApiPropertyOptional()
  timeRangeMonths?: number

}

export class BulkAnalyzeDto {
  @ApiProperty()
  userId: string

  @ApiPropertyOptional({ enum: AnalysisType, isArray: true })
  analysisTypes?: AnalysisType[]

  @ApiPropertyOptional()
  forceReanalysis?: boolean

  @ApiPropertyOptional()
  timeRangeMonths?: number
}

export class TransactionAnalysisResponseDto {
  @ApiProperty()
  transactionId: string

  @ApiProperty()
  analyses?: any[]

  @ApiPropertyOptional()
  executionTime?: number
}

export class BulkAnalysisResponseDto {
  @ApiProperty()
  userId: string

  @ApiProperty()
  totalTransactions: number

  @ApiProperty()
  successfulAnalyses: number

  @ApiProperty()
  failedAnalyses: number

  @ApiProperty()
  results: any[]

  @ApiPropertyOptional()
  totalExecutionTime?: number
}

export class AnalysisStatsDto {
  @ApiProperty()
  userId: string

  @ApiProperty()
  totalAnalyses: number

  @ApiProperty()
  analysesByType: Record<string, number>

  @ApiProperty()
  averageConfidence: number

  @ApiProperty()
  riskDistribution: Record<string, number>

  @ApiPropertyOptional()
  lastAnalysisDate?: Date
}