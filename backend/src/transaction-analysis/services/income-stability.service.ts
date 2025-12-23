import { Injectable, Logger } from "@nestjs/common"
import { Transaction } from "../entities/transaction.entity"
import { AnalysisType } from "../entities/transaction-analysis.entity"
import { RiskLevel, TransactionType } from "../entities/transaction-analysis.entity"

export interface IncomeStabilityResult {
  transactionId: string
  userId: string
  analysisType: AnalysisType.INCOME_STABILITY
  confidence: number
  riskLevel: RiskLevel
  score: number
  result: {
    stabilityScore: number
    incomePattern: "stable" | "irregular" | "declining" | "growing"
    monthlyIncome: number
    incomeVariability: number
    incomeFrequency: "regular" | "irregular" | "sporadic"
    incomeSources: IncomeSource[]
    seasonalityFactor: number
    predictability: number
  }
  features: Record<string, any>
  modelVersion: string
  insights: string[]
  recommendations: string[]
}

export interface IncomeSource {
  source: string
  monthlyAmount: number
  frequency: number
  reliability: number
  lastSeen: Date
}

@Injectable()
export class IncomeStabilityService {
  private readonly logger = new Logger(IncomeStabilityService.name)

  async assessIncomeStability(
    transaction: Transaction,
    historicalTransactions: Transaction[],
  ): Promise<IncomeStabilityResult> {
    this.logger.log(`Assessing income stability for transaction ${transaction.id}`)

    // Filter for credit transactions (income)
    const incomeTransactions = historicalTransactions.filter((t) => t.type === TransactionType.CREDIT)

    const features = this.extractIncomeFeatures(transaction, incomeTransactions)
    const stabilityAnalysis = this.analyzeIncomeStability(incomeTransactions)
    const incomeSources = this.identifyIncomeSources(incomeTransactions)

    const insights = this.generateIncomeInsights(stabilityAnalysis, incomeSources)
    const recommendations = this.generateIncomeRecommendations(stabilityAnalysis)

    return {
      transactionId: transaction.id,
      userId: transaction.userId,
      analysisType: AnalysisType.INCOME_STABILITY,
      confidence: 0.8,
      riskLevel: this.assessIncomeRisk(stabilityAnalysis),
      score: stabilityAnalysis.stabilityScore,
      result: {
        stabilityScore: stabilityAnalysis.stabilityScore,
        incomePattern: stabilityAnalysis.pattern,
        monthlyIncome: stabilityAnalysis.monthlyIncome,
        incomeVariability: stabilityAnalysis.variability,
        incomeFrequency: stabilityAnalysis.frequency,
        incomeSources,
        seasonalityFactor: stabilityAnalysis.seasonalityFactor,
        predictability: stabilityAnalysis.predictability,
      },
      features,
      modelVersion: "1.0.0",
      insights,
      recommendations,
    }
  }

  private extractIncomeFeatures(transaction: Transaction, incomeTransactions: Transaction[]): Record<string, any> {
    const amounts = incomeTransactions.map((t) => Number(t.amount))

    return {
      totalIncomeTransactions: incomeTransactions.length,
      averageIncomeAmount: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
      incomeVariance: this.calculateVariance(amounts),
      uniqueIncomeSources: new Set(incomeTransactions.map((t) => t.merchantName || "unknown")).size,
      timeSpanDays: this.calculateTimeSpan(incomeTransactions),
      currentTransactionAmount: Number(transaction.amount),
      isIncomeTransaction: TransactionType.CREDIT,
    }
  }

  private analyzeIncomeStability(incomeTransactions: Transaction[]): any {
    if (incomeTransactions.length < 3) {
      return {
        stabilityScore: 0,
        pattern: "insufficient_data",
        monthlyIncome: 0,
        variability: 0,
        frequency: "unknown",
        seasonalityFactor: 0,
        predictability: 0,
      }
    }

    // Group by month
    const monthlyIncome = this.groupIncomeByMonth(incomeTransactions)
    const monthlyAmounts = Object.values(monthlyIncome)

    // Calculate stability metrics
    const averageMonthlyIncome = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length
    const incomeVariability = this.calculateCoefficientOfVariation(monthlyAmounts)
    const frequency = this.analyzeIncomeFrequency(incomeTransactions)
    const pattern = this.determineIncomePattern(monthlyAmounts)
    const seasonalityFactor = this.calculateSeasonality(monthlyAmounts)
    const predictability = this.calculatePredictability(monthlyAmounts)

    // Calculate overall stability score (0-100)
    let stabilityScore = 100

    // Penalize high variability
    stabilityScore -= incomeVariability * 50

    // Penalize irregular frequency
    if (frequency === "irregular") stabilityScore -= 20
    if (frequency === "sporadic") stabilityScore -= 40

    // Penalize declining pattern
    if (pattern === "declining") stabilityScore -= 30

    // Bonus for growing pattern
    if (pattern === "growing") stabilityScore += 10

    stabilityScore = Math.max(0, Math.min(100, stabilityScore))

    return {
      stabilityScore,
      pattern,
      monthlyIncome: averageMonthlyIncome,
      variability: incomeVariability,
      frequency,
      seasonalityFactor,
      predictability,
    }
  }

  private identifyIncomeSources(incomeTransactions: Transaction[]): IncomeSource[] {
    const sourceMap = new Map<string, Transaction[]>()

    // Group transactions by source (merchant name or description)
    incomeTransactions.forEach((transaction) => {
      const source = transaction.merchantName || transaction.rawDescription || "Unknown Source"
      if (!sourceMap.has(source)) {
        sourceMap.set(source, [])
      }
      sourceMap.get(source)!.push(transaction)
    })

    const incomeSources: IncomeSource[] = []

    sourceMap.forEach((transactions, source) => {
      const amounts = transactions.map((t) => Number(t.amount))
      const totalAmount = amounts.reduce((a, b) => a + b, 0)
      const averageAmount = totalAmount / amounts.length

      // Calculate monthly amount (approximate)
      const timeSpanMonths = this.calculateTimeSpanInMonths(transactions)
      const monthlyAmount = timeSpanMonths > 0 ? totalAmount / timeSpanMonths : totalAmount

      // Calculate frequency (transactions per month)
      const frequency = timeSpanMonths > 0 ? transactions.length / timeSpanMonths : 0

      // Calculate reliability based on consistency
      const reliability = this.calculateSourceReliability(transactions)

      // Get last transaction date
      const lastSeen = new Date(Math.max(...transactions.map((t) => new Date(t.transactionDate).getTime())))

      incomeSources.push({
        source,
        monthlyAmount,
        frequency,
        reliability,
        lastSeen,
      })
    })

    // Sort by monthly amount (descending)
    return incomeSources.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  }

  private groupIncomeByMonth(transactions: Transaction[]): Record<string, number> {
    const monthlyIncome: Record<string, number> = {}

    transactions.forEach((transaction) => {
      const date = new Date(transaction.transactionDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthlyIncome[monthKey]) {
        monthlyIncome[monthKey] = 0
      }
      monthlyIncome[monthKey] += Number(transaction.amount)
    })

    return monthlyIncome
  }

  private analyzeIncomeFrequency(transactions: Transaction[]): "regular" | "irregular" | "sporadic" {
    if (transactions.length < 5) return "sporadic"

    // Calculate intervals between transactions
    const sortedTransactions = transactions.sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
    )

    const intervals: number[] = []
    for (let i = 1; i < sortedTransactions.length; i++) {
      const interval =
        new Date(sortedTransactions[i].transactionDate).getTime() -
        new Date(sortedTransactions[i - 1].transactionDate).getTime()
      intervals.push(interval / (1000 * 60 * 60 * 24)) // Convert to days
    }

    const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const intervalVariability = this.calculateCoefficientOfVariation(intervals)

    // Classify frequency
    if (intervalVariability < 0.3 && averageInterval <= 35) {
      return "regular" // Low variability, monthly or more frequent
    } else if (intervalVariability < 0.6) {
      return "irregular" // Moderate variability
    } else {
      return "sporadic" // High variability
    }
  }

  private determineIncomePattern(monthlyAmounts: number[]): "stable" | "irregular" | "declining" | "growing" {
    if (monthlyAmounts.length < 3) return "irregular"

    // Calculate trend using linear regression
    const x = monthlyAmounts.map((_, i) => i)
    const y = monthlyAmounts

    const { slope } = this.linearRegression(x, y)
    const averageIncome = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length
    const relativeSlope = slope / averageIncome

    // Determine pattern based on slope and variability
    const variability = this.calculateCoefficientOfVariation(monthlyAmounts)

    if (variability > 0.5) {
      return "irregular"
    } else if (relativeSlope > 0.05) {
      return "growing"
    } else if (relativeSlope < -0.05) {
      return "declining"
    } else {
      return "stable"
    }
  }

  private calculateSeasonality(monthlyAmounts: number[]): number {
    if (monthlyAmounts.length < 12) return 0

    // Simple seasonality calculation - could be enhanced
    const mean = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length
    const deviations = monthlyAmounts.map((amount) => Math.abs(amount - mean))
    const maxDeviation = Math.max(...deviations)

    return mean > 0 ? maxDeviation / mean : 0
  }

  private calculatePredictability(monthlyAmounts: number[]): number {
    if (monthlyAmounts.length < 3) return 0

    // Use coefficient of variation as inverse of predictability
    const cv = this.calculateCoefficientOfVariation(monthlyAmounts)
    return Math.max(0, 1 - cv)
  }

  private calculateSourceReliability(transactions: Transaction[]): number {
    if (transactions.length < 2) return 0.5

    // Calculate consistency of amounts and timing
    const amounts = transactions.map((t) => Number(t.amount))
    const amountCV = this.calculateCoefficientOfVariation(amounts)

    // Calculate timing consistency
    const sortedTransactions = transactions.sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
    )

    const intervals: number[] = []
    for (let i = 1; i < sortedTransactions.length; i++) {
      const interval =
        new Date(sortedTransactions[i].transactionDate).getTime() -
        new Date(sortedTransactions[i - 1].transactionDate).getTime()
      intervals.push(interval)
    }

    const intervalCV = intervals.length > 1 ? this.calculateCoefficientOfVariation(intervals) : 1

    // Combine amount and timing reliability
    const amountReliability = Math.max(0, 1 - amountCV)
    const timingReliability = Math.max(0, 1 - intervalCV)

    return (amountReliability + timingReliability) / 2
  }

  private assessIncomeRisk(stabilityAnalysis: any): RiskLevel {
    const { stabilityScore, pattern, variability } = stabilityAnalysis

    if (stabilityScore < 30 || pattern === "declining") return RiskLevel.HIGH
    if (stabilityScore < 50 || variability > 0.7) return RiskLevel.MEDIUM
    if (stabilityScore < 70) return RiskLevel.LOW
    return RiskLevel.LOW
  }

  private generateIncomeInsights(stabilityAnalysis: any, incomeSources: IncomeSource[]): string[] {
    const insights: string[]  = []

    if (stabilityAnalysis.stabilityScore > 80) {
      insights.push("Very stable income pattern detected")
    } else if (stabilityAnalysis.stabilityScore < 40) {
      insights.push("Unstable income pattern - high variability detected")
    }

    if (stabilityAnalysis.pattern === "growing") {
      insights.push("Income shows positive growth trend")
    } else if (stabilityAnalysis.pattern === "declining") {
      insights.push("Income shows declining trend - requires attention")
    }

    if (incomeSources.length === 1) {
      insights.push("Single income source detected - consider diversification")
    } else if (incomeSources.length > 3) {
      insights.push("Multiple income sources provide good diversification")
    }

    return insights
  }

  private generateIncomeRecommendations(stabilityAnalysis: any): string[] {
    const recommendations: string[]  = []

    if (stabilityAnalysis.stabilityScore < 50) {
      recommendations.push("Work on stabilizing income sources")
    }

    if (stabilityAnalysis.pattern === "declining") {
      recommendations.push("Investigate causes of declining income")
    }

    if (stabilityAnalysis.variability > 0.6) {
      recommendations.push("Consider building emergency fund for income volatility")
    }

    return recommendations
  }

  // Utility methods
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length
    return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length
  }

  private calculateCoefficientOfVariation(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length
    if (mean === 0) return 0
    const stdDev = Math.sqrt(this.calculateVariance(numbers))
    return stdDev / mean
  }

  private calculateTimeSpan(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0
    const dates = transactions.map((t) => new Date(t.transactionDate).getTime())
    return (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) // Days
  }

  private calculateTimeSpanInMonths(transactions: Transaction[]): number {
    return this.calculateTimeSpan(transactions) / 30.44 // Average days per month
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    return { slope, intercept }
  }
}
