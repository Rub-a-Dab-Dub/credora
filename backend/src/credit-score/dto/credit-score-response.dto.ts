import { ApiProperty } from "@nestjs/swagger"
import { CreditGrade } from "../entities/credit-score.entity"

export class ScoreFactorDto {
  @ApiProperty()
  category: string

  @ApiProperty()
  impact: number

  @ApiProperty()
  description: string

  @ApiProperty()
  weight: number
}

export class CreditScoreResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  userId: string

  @ApiProperty({ minimum: 300, maximum: 850 })
  score: number

  @ApiProperty({ enum: CreditGrade })
  grade: CreditGrade

  @ApiProperty({ minimum: 0, maximum: 1 })
  confidence: number

  @ApiProperty()
  modelId: string

  @ApiProperty({ type: [ScoreFactorDto] })
  scoringFactors: ScoreFactorDto[]

  @ApiProperty()
  explanation: {
    primaryFactors: string[]
    improvementSuggestions: string[]
    riskAssessment: string
  }

  @ApiProperty()
  createdAt: Date
}
