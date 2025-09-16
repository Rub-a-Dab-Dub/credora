import { Injectable, Logger } from "@nestjs/common"
import { Transaction } from "../entities/transaction.entity";
import { TransactionAnalysis, AnalysisType, RiskLevel } from "../entities/transaction-analysis.entity";
import { TransactionType } from "../entities/transaction-analysis.entity"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"


export interface CashFlowResult {
  transactionId: string
  userId: string
  analysisType: AnalysisType.CASH_FLOW
  confidence: number
  riskLevel: RiskLevel
  score: number
  result: {
    currentCashFlow: number
    projectedCashFlow: number
    cashFlowTrend: "positive" | "negative" | "stable" | "volatile"
    burnRate: number
    runwayMonths: number
    cashFlowRatio: number
    liquidityScore: number
    seasonalFactors: Record<string, number>
    riskFactors: string[]
  }
  features: Record<string, any>
  modelVersion: string
  insights: string[]
  recommendations: string[]
}

@Injectable()
export class CashFlowService {
  private readonly logger = new Logger(CashFlowService.name)

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(TransactionAnalysis)
    private readonly analysisRepo: Repository<TransactionAnalysis>,
  ) {}

  async analyzeCashFlow(transaction: Transaction, historicalTransactions: Transaction[]): Promise<CashFlowResult> {
    this.logger.log(`Analyzing cash flow for transaction ${transaction.id}`)

    const features = this.extractCashFlowFeatures(transaction, historicalTransactions)
    const cashFlowAnalysis = this.performCashFlowAnalysis(historicalTransactions)
    const riskFactors = this.identifyRiskFactors(cashFlowAnalysis)

    const insights = this.generateCashFlowInsights(cashFlowAnalysis, riskFactors)
    const recommendations = this.generateCashFlowRecommendations(cashFlowAnalysis, riskFactors)

    return {
      transactionId: transaction.id,
      userId: transaction.userId,
      analysisType: AnalysisType.CASH_FLOW,
      confidence: 0.85,
      riskLevel: this.assessCashFlowRisk(cashFlowAnalysis, riskFactors),
      score: this.calculateCashFlowScore(cashFlowAnalysis),
      result: {
        currentCashFlow: cashFlowAnalysis.currentCashFlow,
        projectedCashFlow: cashFlowAnalysis.projectedCashFlow,
        cashFlowTrend: cashFlowAnalysis.trend,
        burnRate: cashFlowAnalysis.burnRate,
        runwayMonths: cashFlowAnalysis.runwayMonths,
        cashFlowRatio: cashFlowAnalysis.cashFlowRatio,
        liquidityScore: cashFlowAnalysis.liquidityScore,
        seasonalFactors: cashFlowAnalysis.seasonalFactors,
        riskFactors,
      },
      features,
      modelVersion: "1.0.0",
      insights,
      recommendations,
    }
  }
  async analyze(transaction: Transaction): Promise<TransactionAnalysis> {
    const historical = await this.txRepo.find({ where: { userId: transaction.userId } });
    const result = await this.analyzeCashFlow(transaction, historical);
    const analysis = this.analysisRepo.create({
    transactionId: transaction.id,
    userId: transaction.userId,
    type: AnalysisType.CASH_FLOW, 
    score: result.score,
    confidence: result.confidence,
    riskLevel: result.riskLevel,
    data: {
      result: result.result,
      features: result.features,
      modelVersion: result.modelVersion,
      insights: result.insights,
      recommendations: result.recommendations,
    },
    transaction,
  })
    return this.analysisRepo.save(analysis);
  }

  private extractCashFlowFeatures(
    transaction: Transaction,
    historicalTransactions: Transaction[],
  ): Record<string, any> {
    const inflows = historicalTransactions.filter((t) => t.type === TransactionType.CREDIT)
    const outflows = historicalTransactions.filter((t) => t.type === TransactionType.DEBIT)

    const totalInflow = inflows.reduce((sum, t) => sum + Number(t.amount), 0)
    const totalOutflow = outflows.reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      totalTransactions: historicalTransactions.length,
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      inflowCount: inflows.length,
      outflowCount: outflows.length,
      averageInflowAmount: inflows.length > 0 ? totalInflow / inflows.length : 0,
      averageOutflowAmount: outflows.length > 0 ? totalOutflow / outflows.length : 0,
      currentTransactionAmount: Number(transaction.amount),
      currentTransactionType: transaction.type,
      timeSpanDays: this.calculateTimeSpan(historicalTransactions),
    }
  }

  private performCashFlowAnalysis(transactions: Transaction[]): any {
    if (transactions.length === 0) {
      return this.getDefaultCashFlowAnalysis()
    }

    // Separate inflows and outflows
    const inflows = transactions.filter((t) => t.type === TransactionType.CREDIT)
    const outflows = transactions.filter((t) => t.type === TransactionType.DEBIT)

    // Calculate monthly cash flow
    const monthlyCashFlow = this.calculateMonthlyCashFlow(transactions)
    const monthlyInflows = this.calculateMonthlyInflows(inflows)
    const monthlyOutflows = this.calculateMonthlyOutflows(outflows)

    // Current cash flow (last month)
    const currentCashFlow = this.getCurrentCashFlow(monthlyCashFlow)

    // Projected cash flow (next month based on trend)
    const projectedCashFlow = this.projectCashFlow(monthlyCashFlow)

    // Cash flow trend
    const trend = this.analyzeCashFlowTrend(monthlyCashFlow)

    // Burn rate (monthly outflow)
    const burnRate = this.calculateBurnRate(monthlyOutflows)

    // Runway (months of expenses covered by current cash flow)
    const runwayMonths = this.calculateRunway(currentCashFlow, burnRate)

    // Cash flow ratio (inflow/outflow)
    const cashFlowRatio = this.calculateCashFlowRatio(monthlyInflows, monthlyOutflows)

    // Liquidity score
    const liquidityScore = this.calculateLiquidityScore(monthlyCashFlow, trend)

    // Seasonal factors
    const seasonalFactors = this.analyzeSeasonalFactors(monthlyCashFlow)

    return {
      currentCashFlow,
      projectedCashFlow,
      trend,
      burnRate,
      runwayMonths,
      cashFlowRatio,
      liquidityScore,
      seasonalFactors,
      monthlyCashFlow,
      monthlyInflows,
      monthlyOutflows,
    }
  }

  private calculateMonthlyCashFlow(transactions: Transaction[]): Record<string, number> {
    const monthlyCashFlow: Record<string, number> = {}

    transactions.forEach((transaction) => {
      const date = new Date(transaction.transactionDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const amount = Number(transaction.amount)

      if (!monthlyCashFlow[monthKey]) {
        monthlyCashFlow[monthKey] = 0
      }

      if (transaction.type === TransactionType.CREDIT) {
        monthlyCashFlow[monthKey] += amount
      } else {
        monthlyCashFlow[monthKey] -= amount
      }
    })

    return monthlyCashFlow
  }

  private calculateMonthlyInflows(inflows: Transaction[]): Record<string, number> {
    const monthlyInflows: Record<string, number> = {}

    inflows.forEach((transaction) => {
      const date = new Date(transaction.transactionDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthlyInflows[monthKey]) {
        monthlyInflows[monthKey] = 0
      }
      monthlyInflows[monthKey] += Number(transaction.amount)
    })

    return monthlyInflows
  }

  private calculateMonthlyOutflows(outflows: Transaction[]): Record<string, number> {
    const monthlyOutflows: Record<string, number> = {}

    outflows.forEach((transaction) => {
      const date = new Date(transaction.transactionDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthlyOutflows[monthKey]) {
        monthlyOutflows[monthKey] = 0
      }
      monthlyOutflows[monthKey] += Number(transaction.amount)
    })

    return monthlyOutflows
  }

  private getCurrentCashFlow(monthlyCashFlow: Record<string, number>): number {
    const months = Object.keys(monthlyCashFlow).sort()
    return months.length > 0 ? monthlyCashFlow[months[months.length - 1]] : 0
  }

  private projectCashFlow(monthlyCashFlow: Record<string, number>): number {
    const values = Object.values(monthlyCashFlow)
    if (values.length < 3) return values[values.length - 1] || 0

    // Simple linear projection based on recent trend
    const recentValues = values.slice(-3)
    const trend = (recentValues[2] - recentValues[0]) / 2
    return recentValues[2] + trend
  }

  private analyzeCashFlowTrend(
    monthlyCashFlow: Record<string, number>,
  ): "positive" | "negative" | "stable" | "volatile" {
    const values = Object.values(monthlyCashFlow)
    if (values.length < 3) return "stable"

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean)

    // Check for volatility
    if (coefficientOfVariation > 1) return "volatile"

    // Check trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstHalfMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondHalfMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const changePercent = ((secondHalfMean - firstHalfMean) / Math.abs(firstHalfMean)) * 100

    if (changePercent > 10) return "positive"
    if (changePercent < -10) return "negative"
    return "stable"
  }

  private calculateBurnRate(monthlyOutflows: Record<string, number>): number {
    const values = Object.values(monthlyOutflows)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }

  private calculateRunway(currentCashFlow: number, burnRate: number): number {
    if (burnRate <= 0 || currentCashFlow <= 0) return 0
    return currentCashFlow / burnRate
  }

  private calculateCashFlowRatio(
    monthlyInflows: Record<string, number>,
    monthlyOutflows: Record<string, number>,
  ): number {
    const totalInflows = Object.values(monthlyInflows).reduce((a, b) => a + b, 0)
    const totalOutflows = Object.values(monthlyOutflows).reduce((a, b) => a + b, 0)

    return totalOutflows > 0 ? totalInflows / totalOutflows : 0
  }

  private calculateLiquidityScore(monthlyCashFlow: Record<string, number>, trend: string): number {
    const values = Object.values(monthlyCashFlow)
    if (values.length === 0) return 0

    let score = 50 // Base score

    // Adjust based on current cash flow
    const currentCashFlow = values[values.length - 1]
    if (currentCashFlow > 0) score += 30
    if (currentCashFlow < 0) score -= 30

    // Adjust based on trend
    switch (trend) {
      case "positive":
        score += 20
        break
      case "negative":
        score -= 20
        break
      case "volatile":
        score -= 15
        break
    }

    // Adjust based on consistency
    const positiveMonths = values.filter((v) => v > 0).length
    const consistencyRatio = positiveMonths / values.length
    score += (consistencyRatio - 0.5) * 40

    return Math.max(0, Math.min(100, score))
  }

  private analyzeSeasonalFactors(monthlyCashFlow: Record<string, number>): Record<string, number> {
    const seasonalFactors: Record<string, number> = {}
    const monthlyData: Record<number, number[]> = {}

    // Group by month of year
    Object.entries(monthlyCashFlow).forEach(([monthKey, value]) => {
      const month = Number.parseInt(monthKey.split("-")[1])
      if (!monthlyData[month]) {
        monthlyData[month] = []
      }
      monthlyData[month].push(value)
    })

    // Calculate average for each month
    const overallMean =
      Object.values(monthlyCashFlow).reduce((a, b) => a + b, 0) / Object.values(monthlyCashFlow).length

    for (let month = 1; month <= 12; month++) {
      if (monthlyData[month] && monthlyData[month].length > 0) {
        const monthMean = monthlyData[month].reduce((a, b) => a + b, 0) / monthlyData[month].length
        seasonalFactors[month.toString()] = overallMean !== 0 ? monthMean / overallMean : 1
      } else {
        seasonalFactors[month.toString()] = 1
      }
    }

    return seasonalFactors
  }

  private identifyRiskFactors(cashFlowAnalysis: any): string[] {
    const riskFactors: string[] = []

    if (cashFlowAnalysis.currentCashFlow < 0) {
      riskFactors.push("Negative current cash flow")
    }

    if (cashFlowAnalysis.trend === "negative") {
      riskFactors.push("Declining cash flow trend")
    }

    if (cashFlowAnalysis.trend === "volatile") {
      riskFactors.push("High cash flow volatility")
    }

    if (cashFlowAnalysis.runwayMonths < 3) {
      riskFactors.push("Low cash runway (less than 3 months)")
    }

    if (cashFlowAnalysis.cashFlowRatio < 1) {
      riskFactors.push("Outflows exceed inflows")
    }

    if (cashFlowAnalysis.liquidityScore < 30) {
      riskFactors.push("Poor liquidity position")
    }

    return riskFactors
  }

  private assessCashFlowRisk(cashFlowAnalysis: any, riskFactors: string[]): RiskLevel {
    let riskScore = 0

    // High risk factors
    if (riskFactors.includes("Negative current cash flow")) riskScore += 30
    if (riskFactors.includes("Declining cash flow trend")) riskScore += 25
    if (riskFactors.includes("Low cash runway (less than 3 months)")) riskScore += 20

    // Medium risk factors
    if (riskFactors.includes("High cash flow volatility")) riskScore += 15
    if (riskFactors.includes("Outflows exceed inflows")) riskScore += 15
    if (riskFactors.includes("Poor liquidity position")) riskScore += 10

    if (riskScore >= 50) return RiskLevel.HIGH
    if (riskScore >= 25) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  private calculateCashFlowScore(cashFlowAnalysis: any): number {
    let score = cashFlowAnalysis.liquidityScore

    // Adjust based on trend
    if (cashFlowAnalysis.trend === "positive") score += 10
    if (cashFlowAnalysis.trend === "negative") score -= 15
    if (cashFlowAnalysis.trend === "volatile") score -= 10

    // Adjust based on cash flow ratio
    if (cashFlowAnalysis.cashFlowRatio > 1.2) score += 10
    if (cashFlowAnalysis.cashFlowRatio < 0.8) score -= 15

    return Math.max(0, Math.min(100, score))
  }

  private generateCashFlowInsights(cashFlowAnalysis: any, riskFactors: string[]): string[] {
    const insights: string[]  = []

    if (cashFlowAnalysis.trend === "positive") {
      insights.push("Cash flow shows positive trend")
    } else if (cashFlowAnalysis.trend === "negative") {
      insights.push("Cash flow is declining - requires immediate attention")
    }

    if (cashFlowAnalysis.liquidityScore > 80) {
      insights.push("Strong liquidity position")
    } else if (cashFlowAnalysis.liquidityScore < 40) {
      insights.push("Weak liquidity position")
    }

    if (cashFlowAnalysis.runwayMonths > 12) {
      insights.push("Healthy cash runway of over 12 months")
    } else if (cashFlowAnalysis.runwayMonths < 6) {
      insights.push("Limited cash runway - consider cost reduction")
    }

    if (riskFactors.length > 2) {
      insights.push("Multiple cash flow risk factors identified")
    }

    return insights
  }

  private generateCashFlowRecommendations(cashFlowAnalysis: any, riskFactors: string[]): string[] {
    const recommendations: string[]  = []

    if (riskFactors.includes("Negative current cash flow")) {
      recommendations.push("Implement immediate cost reduction measures")
      recommendations.push("Explore additional income sources")
    }

    if (riskFactors.includes("High cash flow volatility")) {
      recommendations.push("Build emergency fund to smooth cash flow variations")
    }

    if (cashFlowAnalysis.cashFlowRatio < 1) {
      recommendations.push("Reduce expenses to improve cash flow ratio")
    }

    if (cashFlowAnalysis.runwayMonths < 6) {
      recommendations.push("Prioritize cash conservation strategies")
    }

    if (cashFlowAnalysis.trend === "negative") {
      recommendations.push("Analyze spending patterns to identify cost-cutting opportunities")
    }

    return recommendations
  }

  private getDefaultCashFlowAnalysis(): any {
    return {
      currentCashFlow: 0,
      projectedCashFlow: 0,
      trend: "stable",
      burnRate: 0,
      runwayMonths: 0,
      cashFlowRatio: 0,
      liquidityScore: 0,
      seasonalFactors: {},
    }
  }

  private calculateTimeSpan(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0
    const dates = transactions.map((t) => new Date(t.transactionDate).getTime())
    return (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) // Days
  }
  
}
