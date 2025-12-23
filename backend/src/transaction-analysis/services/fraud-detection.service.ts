import { Injectable, Logger } from "@nestjs/common"
import { type Transaction } from "../entities/transaction.entity"
import { TransactionType } from "../entities/transaction-analysis.entity"
import { AnalysisType } from "../entities/transaction-analysis.entity"
import { RiskLevel } from "../entities/transaction-analysis.entity"


export interface FraudDetectionResult {
  transactionId: string
  userId: string
  analysisType: AnalysisType.FRAUD_DETECTION
  confidence: number
  riskLevel: RiskLevel
  score: number
  result: {
    fraudProbability: number
    riskFactors: string[]
    anomalies: string[]
    ruleTriggered: string[]
    geographicRisk: number
    velocityRisk: number
    amountRisk: number
    timeRisk: number
  }
  features: Record<string, any>
  modelVersion: string
  insights: string[]
  recommendations: string[]
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name)

  // Fraud detection rules and thresholds
  private readonly fraudRules = {
    maxDailyTransactions: 20,
    maxHourlyTransactions: 5,
    maxAmountDeviation: 5, // Standard deviations
    suspiciousTimeWindows: [
      { start: 2, end: 5 }, // 2 AM - 5 AM
    ],
    highRiskMerchants: ["cash_advance", "gambling", "adult_entertainment", "cryptocurrency"],
    velocityThresholds: {
      transactions_per_minute: 3,
      amount_per_hour: 5000,
      unique_merchants_per_hour: 10,
    },
  }

  async detectFraud(transaction: Transaction, historicalTransactions: Transaction[]): Promise<FraudDetectionResult> {
    this.logger.log(`Running fraud detection for transaction ${transaction.id}`)

    const features = this.extractFraudFeatures(transaction, historicalTransactions)
    const riskFactors = []
    const anomalies = []
    const rulesTriggered = []

    // Run fraud detection rules
    const velocityRisk = this.checkVelocityRisk(transaction, historicalTransactions, riskFactors, rulesTriggered)
    const amountRisk = this.checkAmountRisk(transaction, historicalTransactions, riskFactors, anomalies)
    const timeRisk = this.checkTimeRisk(transaction, riskFactors, rulesTriggered)
    const geographicRisk = this.checkGeographicRisk(transaction, historicalTransactions, riskFactors)
    const merchantRisk = this.checkMerchantRisk(transaction, riskFactors, rulesTriggered)
    const patternRisk = this.checkPatternAnomalies(transaction, historicalTransactions, anomalies)

    // Calculate overall fraud probability
    const fraudProbability = this.calculateFraudProbability({
      velocityRisk,
      amountRisk,
      timeRisk,
      geographicRisk,
      merchantRisk,
      patternRisk,
    })

    const riskLevel = this.assessFraudRiskLevel(fraudProbability)
    const insights = this.generateFraudInsights(fraudProbability, riskFactors, anomalies)
    const recommendations = this.generateFraudRecommendations(fraudProbability, riskFactors)

    return {
      transactionId: transaction.id,
      userId: transaction.userId,
      analysisType: AnalysisType.FRAUD_DETECTION,
      confidence: 0.9,
      riskLevel,
      score: (1 - fraudProbability) * 100,
      result: {
        fraudProbability,
        riskFactors,
        anomalies,
        ruleTriggered: rulesTriggered,
        geographicRisk,
        velocityRisk,
        amountRisk,
        timeRisk,
      },
      features,
      modelVersion: "1.0.0",
      insights,
      recommendations,
    }
  }

  private extractFraudFeatures(transaction: Transaction, historicalTransactions: Transaction[]): Record<string, any> {
    const now = new Date(transaction.transactionDate)
    const last24Hours = historicalTransactions.filter(
      (t) => new Date(t.transactionDate) >= new Date(now.getTime() - 24 * 60 * 60 * 1000),
    )

    return {
      transactionAmount: Number(transaction.amount),
      transactionHour: now.getHours(),
      transactionDay: now.getDay(),
      isWeekend: [0, 6].includes(now.getDay()),
      channel: transaction.channel,
      location: transaction.location,
      merchantName: transaction.merchantName,
      merchantCategory: transaction.merchantCategory,
      last24HourCount: last24Hours.length,
      last24HourAmount: last24Hours.reduce((sum, t) => sum + Number(t.amount), 0),
      uniqueMerchantsLast24H: new Set(last24Hours.map((t) => t.merchantName)).size,
      averageHistoricalAmount: this.calculateAverage(historicalTransactions.map((t) => Number(t.amount))),
      historicalTransactionCount: historicalTransactions.length,
    }
  }

  private checkVelocityRisk(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    riskFactors: string[],
    rulesTriggered: string[],
  ): number {
    const now = new Date(transaction.transactionDate)

    // Check transactions in last hour
    const lastHour = historicalTransactions.filter(
      (t) => new Date(t.transactionDate) >= new Date(now.getTime() - 60 * 60 * 1000),
    )

    // Check transactions in last minute
    const lastMinute = historicalTransactions.filter(
      (t) => new Date(t.transactionDate) >= new Date(now.getTime() - 60 * 1000),
    )

    let velocityRisk = 0

    // Too many transactions per minute
    if (lastMinute.length >= this.fraudRules.velocityThresholds.transactions_per_minute) {
      velocityRisk += 0.4
      riskFactors.push("High transaction frequency (per minute)")
      rulesTriggered.push("velocity_per_minute")
    }

    // Too much amount per hour
    const hourlyAmount = lastHour.reduce((sum, t) => sum + Number(t.amount), 0)
    if (hourlyAmount >= this.fraudRules.velocityThresholds.amount_per_hour) {
      velocityRisk += 0.3
      riskFactors.push("High transaction volume (per hour)")
      rulesTriggered.push("velocity_amount_per_hour")
    }

    // Too many unique merchants per hour
    const uniqueMerchants = new Set(lastHour.map((t) => t.merchantName)).size
    if (uniqueMerchants >= this.fraudRules.velocityThresholds.unique_merchants_per_hour) {
      velocityRisk += 0.3
      riskFactors.push("High merchant diversity (per hour)")
      rulesTriggered.push("velocity_merchants_per_hour")
    }

    return Math.min(velocityRisk, 1)
  }

  private checkAmountRisk(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    riskFactors: string[],
    anomalies: string[],
  ): number {
    if (historicalTransactions.length < 10) return 0

    const amounts = historicalTransactions.map((t) => Number(t.amount))
    const mean = this.calculateAverage(amounts)
    const stdDev = this.calculateStandardDeviation(amounts)

    if (stdDev === 0) return 0

    const zScore = Math.abs((Number(transaction.amount) - mean) / stdDev)

    let amountRisk = 0

    if (zScore > this.fraudRules.maxAmountDeviation) {
      amountRisk = Math.min(zScore / 10, 1)
      riskFactors.push(`Transaction amount significantly deviates from normal (${zScore.toFixed(2)} std dev)`)
      anomalies.push("unusual_amount")
    }

    // Check for round number amounts (potential fraud indicator)
    if (Number(transaction.amount) % 100 === 0 && Number(transaction.amount) >= 500) {
      amountRisk += 0.1
      anomalies.push("round_amount")
    }

    return Math.min(amountRisk, 1)
  }

  private checkTimeRisk(transaction: Transaction, riskFactors: string[], rulesTriggered: string[]): number {
    const hour = new Date(transaction.transactionDate).getHours()

    let timeRisk = 0

    // Check suspicious time windows
    for (const window of this.fraudRules.suspiciousTimeWindows) {
      if (hour >= window.start && hour <= window.end) {
        timeRisk += 0.3
        riskFactors.push(`Transaction during suspicious hours (${hour}:00)`)
        rulesTriggered.push("suspicious_time")
        break
      }
    }

    return timeRisk
  }

  private checkGeographicRisk(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    riskFactors: string[],
  ): number {
    if (!transaction.location) return 0

    const recentLocations = historicalTransactions
      .filter((t) => t.location && new Date(t.transactionDate) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .map((t) => t.location)

    const uniqueLocations = new Set(recentLocations)

    let geographicRisk = 0

    // New location risk
    if (!uniqueLocations.has(transaction.location)) {
      geographicRisk += 0.2
      riskFactors.push("Transaction from new location")
    }

    // Multiple locations in short time (simplified)
    if (uniqueLocations.size > 5) {
      geographicRisk += 0.3
      riskFactors.push("Multiple locations in recent transactions")
    }

    return Math.min(geographicRisk, 1)
  }

  private checkMerchantRisk(transaction: Transaction, riskFactors: string[], rulesTriggered: string[]): number {
    let merchantRisk = 0

    // Check high-risk merchant categories
    const merchantCategory = transaction.merchantCategory?.toLowerCase() || ""
    const merchantName = transaction.merchantName?.toLowerCase() || ""

    for (const riskCategory of this.fraudRules.highRiskMerchants) {
      if (merchantCategory.includes(riskCategory) || merchantName.includes(riskCategory)) {
        merchantRisk += 0.4
        riskFactors.push(`High-risk merchant category: ${riskCategory}`)
        rulesTriggered.push("high_risk_merchant")
        break
      }
    }

    return merchantRisk
  }

  private checkPatternAnomalies(
    transaction: Transaction,
    historicalTransactions: Transaction[],
    anomalies: string[],
  ): number {
    let patternRisk = 0

    // Check for unusual channel usage
    const channelFrequency = {}
    historicalTransactions.forEach((t) => {
      channelFrequency[t.channel|| "nochannel"] = (channelFrequency[t.channel|| "nochannel"] || 0) + 1
    })

    const totalTransactions = historicalTransactions.length
    const currentChannelFreq = channelFrequency[transaction.channel|| "nochannel"] || 0
    const channelUsageRate = currentChannelFreq / totalTransactions

    if (channelUsageRate < 0.1 && totalTransactions > 20) {
      patternRisk += 0.2
      anomalies.push("unusual_channel")
    }

    // Check for first-time merchant
    const merchantTransactions = historicalTransactions.filter((t) => t.merchantName === transaction.merchantName)

    if (merchantTransactions.length === 0 && Number(transaction.amount) > 500) {
      patternRisk += 0.2
      anomalies.push("new_high_value_merchant")
    }

    return Math.min(patternRisk, 1)
  }

  private calculateFraudProbability(risks: Record<string, number>): number {
    // Weighted combination of risk factors
    const weights = {
      velocityRisk: 0.3,
      amountRisk: 0.25,
      timeRisk: 0.15,
      geographicRisk: 0.15,
      merchantRisk: 0.1,
      patternRisk: 0.05,
    }

    let weightedSum = 0
    for (const [riskType, risk] of Object.entries(risks)) {
      weightedSum += risk * (weights[riskType] || 0)
    }

    return Math.min(weightedSum, 1)
  }

  private assessFraudRiskLevel(fraudProbability: number): RiskLevel {
    if (fraudProbability > 0.8) return RiskLevel.CRITICAL
    if (fraudProbability > 0.6) return RiskLevel.HIGH
    if (fraudProbability > 0.3) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  private generateFraudInsights(fraudProbability: number, riskFactors: string[], anomalies: string[]): string[] {
    const insights: string[]  = []

    if (fraudProbability > 0.7) {
      insights.push("High fraud probability detected - immediate review recommended")
    } else if (fraudProbability > 0.4) {
      insights.push("Moderate fraud risk - additional verification may be needed")
    }

    if (riskFactors.length > 3) {
      insights.push("Multiple risk factors present")
    }

    if (anomalies.length > 0) {
      insights.push(`${anomalies.length} behavioral anomalies detected`)
    }

    return insights
  }

  private generateFraudRecommendations(fraudProbability: number, riskFactors: string[]): string[] {
    const recommendations: string[]  = []

    if (fraudProbability > 0.8) {
      recommendations.push("Block transaction and require manual verification")
      recommendations.push("Contact customer to verify transaction")
    } else if (fraudProbability > 0.5) {
      recommendations.push("Require additional authentication")
      recommendations.push("Monitor subsequent transactions closely")
    } else if (fraudProbability > 0.3) {
      recommendations.push("Flag for enhanced monitoring")
    }

    if (riskFactors.some((rf) => rf.includes("velocity"))) {
      recommendations.push("Implement velocity controls")
    }

    return recommendations
  }

  // Utility methods
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0
    return numbers.reduce((a, b) => a + b, 0) / numbers.length
  }

  private calculateStandardDeviation(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const mean = this.calculateAverage(numbers)
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length
    return Math.sqrt(variance)
  }
}
