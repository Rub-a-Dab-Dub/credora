import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { InjectQueue } from "@nestjs/bull"
import type { Queue } from "bull"
import { CreditScore } from "./entities/credit-score.entity"
import type { TraditionalCreditCalculator } from "./calculators/traditional-credit.calculator"
import type { UserService } from "../user/user.service"

@Injectable()
export class CreditScoreService {
  constructor(
    @InjectRepository(CreditScore)
    private creditScoreRepository: Repository<CreditScore>,
    private traditionalCreditCalculator: TraditionalCreditCalculator,
    private userService: UserService,
    @InjectQueue("credit-score-calculation")
    private creditScoreQueue: Queue,
  ) {}

  async calculateTraditionalScore(userId: string): Promise<CreditScore> {
    // Get user and their traditional credit data
    const user = await this.userService.findById(userId)
    const traditionalData = await this.userService.getLatestTraditionalCreditData(userId)

    if (!traditionalData) {
      throw new NotFoundException("No traditional credit data found for user")
    }

    // Calculate traditional credit score
    const scoreResult = await this.traditionalCreditCalculator.calculateScore(
      traditionalData,
      Number(user.annualIncome),
    )

    // Create credit score record
    const creditScore = this.creditScoreRepository.create({
      userId,
      score: scoreResult.score,
      grade: scoreResult.grade,
      confidence: scoreResult.confidence,
      modelId: "traditional-model-v1", // This would be a real model ID in production
      scoringFactors: scoreResult.factors,
      inputData: {
        traditional: traditionalData,
        defi: null,
        onChain: null,
        alternative: null,
      },
      explanation: {
        primaryFactors: this.extractPrimaryFactors(scoreResult.factors),
        improvementSuggestions: this.traditionalCreditCalculator.generateImprovementSuggestions(scoreResult.factors),
        riskAssessment: this.generateRiskAssessment(scoreResult.score, scoreResult.grade),
      },
      traditionalWeight: 1.0,
      defiWeight: 0.0,
      onChainWeight: 0.0,
      alternativeWeight: 0.0,
    })

    return this.creditScoreRepository.save(creditScore)
  }

  async getLatestScore(userId: string): Promise<CreditScore | null> {
    return this.creditScoreRepository.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
      relations: ["model"],
    })
  }

  async getScoreHistory(userId: string, limit = 10): Promise<CreditScore[]> {
    return this.creditScoreRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
      relations: ["model"],
    })
  }

  async queueScoreCalculation(userId: string, priority = 0): Promise<void> {
    await this.creditScoreQueue.add(
      "calculate-score",
      { userId },
      {
        priority,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    )
  }

  private extractPrimaryFactors(factors: any[]): string[] {
    return factors
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((factor) => `${factor.category}: ${factor.description}`)
  }

  private generateRiskAssessment(score: number, grade: string): string {
    if (score >= 740) {
      return "Very Low Risk - Excellent creditworthiness with high likelihood of loan approval and best interest rates."
    } else if (score >= 670) {
      return "Low Risk - Good creditworthiness with favorable loan terms and competitive interest rates."
    } else if (score >= 580) {
      return "Moderate Risk - Fair creditworthiness with standard loan terms and moderate interest rates."
    } else if (score >= 500) {
      return "High Risk - Poor creditworthiness with limited loan options and higher interest rates."
    } else {
      return "Very High Risk - Very poor creditworthiness with very limited credit options and highest interest rates."
    }
  }

  // Method to recalculate score when new data is available
  async recalculateScore(userId: string): Promise<CreditScore> {
    return this.calculateTraditionalScore(userId)
  }

  // Batch scoring for multiple users
  async batchCalculateScores(userIds: string[]): Promise<void> {
    const jobs = userIds.map((userId, index) => ({
      name: "calculate-score",
      data: { userId },
      opts: {
        priority: -index, // Process in order
        delay: index * 1000, // Stagger requests
      },
    }))

    await this.creditScoreQueue.addBulk(jobs)
  }
}
