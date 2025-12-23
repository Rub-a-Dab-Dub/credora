import { Processor, Process } from "@nestjs/bull"
import { Logger } from "@nestjs/common"
import type { Job } from "bull"
import type { CreditScoreService } from "../credit-score.service"

@Processor("credit-score-calculation")
export class CreditScoreProcessor {
  private readonly logger = new Logger(CreditScoreProcessor.name)

  constructor(private creditScoreService: CreditScoreService) {}

  @Process("calculate-score")
  async handleScoreCalculation(job: Job<{ userId: string }>) {
    const { userId } = job.data

    try {
      this.logger.log(`Starting credit score calculation for user ${userId}`)

      const creditScore = await this.creditScoreService.calculateTraditionalScore(userId)

      this.logger.log(`Credit score calculation completed for user ${userId}. Score: ${creditScore.score}`)

      return {
        success: true,
        userId,
        score: creditScore.score,
        grade: creditScore.grade,
      }
    } catch (error) {
      this.logger.error(`Credit score calculation failed for user ${userId}`, error.stack)
      throw error
    }
  }
}
