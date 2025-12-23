import { Controller, Get, Post, Param, Query } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger"
import type { CreditScoreService } from "./credit-score.service"
import type { CreditScore } from "./entities/credit-score.entity"

@ApiTags("credit-scores")
@Controller("credit-scores")
export class CreditScoreController {
  constructor(private readonly creditScoreService: CreditScoreService) {}

  @Post("calculate/:userId")
  @ApiOperation({ summary: "Calculate credit score for a user" })
  @ApiResponse({ status: 201, description: "Credit score calculated successfully" })
  @ApiResponse({ status: 404, description: "User or credit data not found" })
  async calculateScore(@Param("userId") userId: string): Promise<CreditScore> {
    return this.creditScoreService.calculateTraditionalScore(userId)
  }

  @Get("latest/:userId")
  @ApiOperation({ summary: "Get latest credit score for a user" })
  @ApiResponse({ status: 200, description: "Latest credit score retrieved" })
  @ApiResponse({ status: 404, description: "No credit score found" })
  async getLatestScore(@Param("userId") userId: string): Promise<CreditScore | null> {
    return this.creditScoreService.getLatestScore(userId)
  }

  @Get("history/:userId")
  @ApiOperation({ summary: "Get credit score history for a user" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Number of scores to retrieve" })
  @ApiResponse({ status: 200, description: "Credit score history retrieved" })
  async getScoreHistory(@Param("userId") userId: string, @Query("limit") limit?: number): Promise<CreditScore[]> {
    return this.creditScoreService.getScoreHistory(userId, limit || 10)
  }

  @Post("queue/:userId")
  @ApiOperation({ summary: "Queue credit score calculation for a user" })
  @ApiResponse({ status: 201, description: "Credit score calculation queued" })
  async queueCalculation(@Param("userId") userId: string): Promise<{ message: string }> {
    await this.creditScoreService.queueScoreCalculation(userId)
    return { message: "Credit score calculation queued successfully" }
  }

  @Post("recalculate/:userId")
  @ApiOperation({ summary: "Recalculate credit score with latest data" })
  @ApiResponse({ status: 201, description: "Credit score recalculated successfully" })
  async recalculateScore(@Param("userId") userId: string): Promise<CreditScore> {
    return this.creditScoreService.recalculateScore(userId)
  }
}
