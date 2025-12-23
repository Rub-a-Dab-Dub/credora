import { Controller, Post, Get, Body, Param, Query, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger"
import type { TransactionAnalysisService } from "../services/transaction-analysis.service"
import type { RuleEngineService } from "../services/rule-engine.service"
import {
  type AnalyzeTransactionDto,
  type BulkAnalyzeDto,
  type GetAnalysisHistoryDto,
  TransactionAnalysisResponseDto,
  BulkAnalysisResponseDto,
  AnalysisStatsDto,
} from "../dto/transaction-analysis.dto"
import type { Repository } from "typeorm"
import { Transaction} from "../entities/transaction.entity"
import { TransactionAnalysis } from "../entities/transaction-analysis.entity"

@ApiTags("Transaction Analysis")
@Controller("transaction-analysis")
export class TransactionAnalysisController {
  private readonly logger = new Logger(TransactionAnalysisController.name)

  constructor(
    private readonly analysisService: TransactionAnalysisService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly transactionRepository: Repository<Transaction>,
    private readonly analysisRepository: Repository<TransactionAnalysis>,
  ) {}

  @Post("analyze")
  @ApiOperation({ summary: "Analyze a single transaction" })
  @ApiResponse({
    status: 200,
    description: "Transaction analysis completed successfully",
    type: TransactionAnalysisResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid request parameters" })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async analyzeTransaction(@Body() analyzeDto: AnalyzeTransactionDto): Promise<TransactionAnalysisResponseDto> {
    try {
      const startTime = Date.now()

      this.logger.log(`Starting analysis for transaction ${analyzeDto.transactionId}`)

      const result = await this.analysisService.analyzeTransaction(analyzeDto.transactionId, {
        analysisTypes: analyzeDto.analysisTypes,
        forceReanalysis: analyzeDto.forceReanalysis,
        includeHistorical: analyzeDto.includeHistorical,
        timeRangeMonths: analyzeDto.timeRangeMonths,
      })

      const executionTime = Date.now() - startTime

      this.logger.log(`Completed analysis for transaction ${analyzeDto.transactionId} in ${executionTime}ms`)

      return {
        ...result,
        analyses: [result], 
        executionTime,
      }
    } catch (error) {
      this.logger.error(`Error analyzing transaction ${analyzeDto.transactionId}:`, error)

      if (error.message.includes("not found")) {
        throw new HttpException("Transaction not found", HttpStatus.NOT_FOUND)
      }

      throw new HttpException("Analysis failed", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post("analyze/bulk")
  @ApiOperation({ summary: "Analyze multiple transactions for a user" })
  @ApiResponse({
    status: 200,
    description: "Bulk analysis completed successfully",
    type: BulkAnalysisResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid request parameters" })
  async analyzeBulkTransactions(@Body() bulkAnalyzeDto: BulkAnalyzeDto): Promise<BulkAnalysisResponseDto> {
    try {
      const startTime = Date.now()

      this.logger.log(`Starting bulk analysis for user ${bulkAnalyzeDto.userId}`)

      const results = await this.analysisService.analyzeBulkTransactions(bulkAnalyzeDto.userId, {
        analysisTypes: bulkAnalyzeDto.analysisTypes,
        forceReanalysis: bulkAnalyzeDto.forceReanalysis,
        timeRangeMonths: bulkAnalyzeDto.timeRangeMonths,
      })

      const totalExecutionTime = Date.now() - startTime
      const successfulAnalyses = results.filter((r) => r.type.length > 0).length
      const failedAnalyses = results.length - successfulAnalyses

      this.logger.log(
        `Completed bulk analysis for user ${bulkAnalyzeDto.userId}: ${successfulAnalyses}/${results.length} successful in ${totalExecutionTime}ms`,
      )

      return {
        userId: bulkAnalyzeDto.userId,
        totalTransactions: results.length,
        successfulAnalyses,
        failedAnalyses,
        results,
        totalExecutionTime,
      }
    } catch (error) {
      this.logger.error(`Error in bulk analysis for user ${bulkAnalyzeDto.userId}:`, error)
      throw new HttpException("Bulk analysis failed", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("history")
  @ApiOperation({ summary: "Get analysis history for a user" })
  @ApiResponse({
    status: 200,
    description: "Analysis history retrieved successfully",
    type: [TransactionAnalysis],
  })
  async getAnalysisHistory(@Query() historyDto: GetAnalysisHistoryDto): Promise<TransactionAnalysis[]> {
    try {
      const whereClause: any = { userId: historyDto.userId }

      if (historyDto.analysisType) {
        whereClause.analysisType = historyDto.analysisType
      }

      const analyses = await this.analysisRepository.find({
        where: whereClause,
        order: { createdAt: "DESC" },
        take: historyDto.limit || 50,
        skip: historyDto.offset || 0,
        relations: ["transaction"],
      })

      return analyses
    } catch (error) {
      this.logger.error(`Error retrieving analysis history for user ${historyDto.userId}:`, error)
      throw new HttpException("Failed to retrieve analysis history", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("stats/:userId")
  @ApiOperation({ summary: "Get analysis statistics for a user" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "Analysis statistics retrieved successfully",
    type: AnalysisStatsDto,
  })
  async getAnalysisStats(@Param("userId") userId: string): Promise<AnalysisStatsDto> {
    try {
      const analyses = await this.analysisRepository.find({
        where: { userId },
        order: { createdAt: "DESC" },
      })

      // Calculate statistics
      const totalAnalyses = analyses.length
      const analysesByType: Record<string, number> = {}
      const riskDistribution: Record<string, number> = {}
      let totalConfidence = 0

      analyses.forEach((analysis) => {
        // Count by type
        analysesByType[analysis.type] = (analysesByType[analysis.type] || 0) + 1

        // Count by risk level
        if (analysis.riskLevel) {
          riskDistribution[analysis.riskLevel] = (riskDistribution[analysis.riskLevel] || 0) + 1
        }

        // Sum confidence scores
        if (analysis.confidence) {
          totalConfidence += analysis.confidence
        }
      })

      const averageConfidence = totalAnalyses > 0 ? totalConfidence / totalAnalyses : 0
      const lastAnalysisDate = analyses.length > 0 ? analyses[0].createdAt : undefined

      return {
        userId,
        totalAnalyses,
        analysesByType,
        averageConfidence,
        riskDistribution,
        lastAnalysisDate,
      }
    } catch (error) {
      this.logger.error(`Error retrieving analysis stats for user ${userId}:`, error)
      throw new HttpException("Failed to retrieve analysis statistics", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("transaction/:transactionId")
  @ApiOperation({ summary: "Get analysis results for a specific transaction" })
  @ApiParam({ name: "transactionId", description: "Transaction ID" })
  @ApiResponse({
    status: 200,
    description: "Transaction analysis results retrieved successfully",
    type: [TransactionAnalysis],
  })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async getTransactionAnalysis(@Param("transactionId") transactionId: string): Promise<TransactionAnalysis[]> {
    try {
      // Verify transaction exists
      const transaction = await this.transactionRepository.findOne({
        where: { id: transactionId },
      })

      if (!transaction) {
        throw new HttpException("Transaction not found", HttpStatus.NOT_FOUND)
      }

      const analyses = await this.analysisRepository.find({
        where: { transactionId },
        order: { createdAt: "DESC" },
      })

      return analyses
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      this.logger.error(`Error retrieving analysis for transaction ${transactionId}:`, error)
      throw new HttpException("Failed to retrieve transaction analysis", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post("reanalyze/:transactionId")
  @ApiOperation({ summary: "Force re-analysis of a transaction" })
  @ApiParam({ name: "transactionId", description: "Transaction ID" })
  @ApiResponse({
    status: 200,
    description: "Transaction re-analysis completed successfully",
    type: TransactionAnalysisResponseDto,
  })
  async reanalyzeTransaction(@Param("transactionId") transactionId: string): Promise<TransactionAnalysisResponseDto> {
    try {
      const result = await this.analysisService.analyzeTransaction(transactionId, {
        forceReanalysis: true,
        includeHistorical: true,
      })

      return result
    } catch (error) {
      this.logger.error(`Error re-analyzing transaction ${transactionId}:`, error)

      if (error.message.includes("not found")) {
        throw new HttpException("Transaction not found", HttpStatus.NOT_FOUND)
      }

      throw new HttpException("Re-analysis failed", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("health")
  @ApiOperation({ summary: "Health check for transaction analysis service" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }
  }
}
