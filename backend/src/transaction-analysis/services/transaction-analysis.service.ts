import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, DeepPartial } from "typeorm"
import { Transaction } from "../entities/transaction.entity"
import { TransactionAnalysis, AnalysisType, RiskLevel } from "../entities/transaction-analysis.entity"
import { UserFinancialProfile } from "../entities/user-financial-profile.entity"

import { CashFlowService } from "./cash-flow.service"
import { CategorizationService } from "./categorization.service"
import { FraudDetectionService } from "./fraud-detection.service"
import { IncomeStabilityService } from "./income-stability.service"

@Injectable()
export class TransactionAnalysisService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    @InjectRepository(TransactionAnalysis)
    private readonly analysisRepo: Repository<TransactionAnalysis>,

    @InjectRepository(UserFinancialProfile)
    private readonly profileRepo: Repository<UserFinancialProfile>,

    private readonly cashFlowService: CashFlowService,
    private readonly categorizationService: CategorizationService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly incomeStabilityService: IncomeStabilityService,
  ) {}

  async analyzeTransaction(
    transactionId: string,
    opts: {
      analysisTypes?: AnalysisType[]
      forceReanalysis?: boolean
      includeHistorical?: boolean
      timeRangeMonths?: number
    }
  ): Promise<TransactionAnalysis> {
    const tx = await this.transactionRepo.findOne({ where: { id: transactionId } })
    if (!tx) throw new Error(`Transaction ${transactionId} not found`)

    let result: any
    let analysisType: AnalysisType

    switch (opts?.analysisTypes?.[0] || AnalysisType.CASH_FLOW) {
      case AnalysisType.CASH_FLOW:
        result = await this.cashFlowService.analyze(tx,) // renamed
        analysisType = AnalysisType.CASH_FLOW
        break
      case AnalysisType.CATEGORIZATION:
        result = await this.categorizationService.categorize(tx)
        analysisType = AnalysisType.CATEGORIZATION
        break
      case AnalysisType.FRAUD_DETECTION:
        result = await this.fraudDetectionService.detectFraud(tx, []) // pass history if needed
        analysisType = AnalysisType.FRAUD_DETECTION
        break
      case AnalysisType.INCOME_STABILITY:
        result = await this.incomeStabilityService.assessIncomeStability(tx, [])
        analysisType = AnalysisType.INCOME_STABILITY
        break
      default:
        throw new Error("Unsupported analysis type")
    }

    // Map result → TransactionAnalysis entity
    const analysis: DeepPartial<TransactionAnalysis> = {
      transactionId: tx.id,
      userId: tx.userId,
      type: analysisType,
      confidence: result.confidence ?? 1,
      riskLevel: result.riskLevel ?? RiskLevel.LOW,
      score: result.score ?? null,
      data: result.result ?? result, // detailed JSON
    }

    return this.analysisRepo.save(analysis)
  }

  async analyzeBulkTransactions(
    userId: string,
    opts: {
      analysisTypes?: AnalysisType[]
      forceReanalysis?: boolean
      includeHistorical?: boolean
      timeRangeMonths?: number
    }
  ): Promise<TransactionAnalysis[]> {
    const txs = await this.transactionRepo.find({ where: { userId } })
    const results: TransactionAnalysis[] = []

    for (const tx of txs) {
      try {
        const analysis = await this.analyzeTransaction(tx.id, opts?.analysisTypes ? {}: opts)
        results.push(analysis)
      } catch (err) {
        console.error(`Skipping tx ${tx.id}: ${err.message}`)
      }
    }

    return results
  }

  async getHistory(userId: string): Promise<TransactionAnalysis[]> {
    return this.analysisRepo.find({ where: { userId }, order: { createdAt: "DESC" } })
  }
}
