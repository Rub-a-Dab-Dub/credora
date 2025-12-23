import { Injectable } from "@nestjs/common"
import type { TraditionalCreditData } from "../../user/entities/traditional-credit-data.entity"
import { CreditGrade } from "../entities/credit-score.entity"

export interface TraditionalScoreResult {
  score: number
  grade: CreditGrade
  factors: ScoreFactor[]
  confidence: number
}

export interface ScoreFactor {
  category: string
  impact: number
  description: string
  weight: number
}

@Injectable()
export class TraditionalCreditCalculator {
  // FICO Score component weights
  private readonly PAYMENT_HISTORY_WEIGHT = 0.35
  private readonly CREDIT_UTILIZATION_WEIGHT = 0.3
  private readonly CREDIT_HISTORY_LENGTH_WEIGHT = 0.15
  private readonly CREDIT_MIX_WEIGHT = 0.1
  private readonly NEW_CREDIT_WEIGHT = 0.1

  async calculateScore(creditData: TraditionalCreditData, annualIncome?: number): Promise<TraditionalScoreResult> {
    const factors: ScoreFactor[] = []

    // 1. Payment History (35%)
    const paymentHistoryScore = this.calculatePaymentHistoryScore(creditData)
    factors.push({
      category: "Payment History",
      impact: paymentHistoryScore.impact,
      description: paymentHistoryScore.description,
      weight: this.PAYMENT_HISTORY_WEIGHT,
    })

    // 2. Credit Utilization (30%)
    const creditUtilizationScore = this.calculateCreditUtilizationScore(creditData)
    factors.push({
      category: "Credit Utilization",
      impact: creditUtilizationScore.impact,
      description: creditUtilizationScore.description,
      weight: this.CREDIT_UTILIZATION_WEIGHT,
    })

    // 3. Credit History Length (15%)
    const creditHistoryScore = this.calculateCreditHistoryScore(creditData)
    factors.push({
      category: "Credit History Length",
      impact: creditHistoryScore.impact,
      description: creditHistoryScore.description,
      weight: this.CREDIT_HISTORY_LENGTH_WEIGHT,
    })

    // 4. Credit Mix (10%)
    const creditMixScore = this.calculateCreditMixScore(creditData)
    factors.push({
      category: "Credit Mix",
      impact: creditMixScore.impact,
      description: creditMixScore.description,
      weight: this.CREDIT_MIX_WEIGHT,
    })

    // 5. New Credit (10%)
    const newCreditScore = this.calculateNewCreditScore(creditData)
    factors.push({
      category: "New Credit",
      impact: newCreditScore.impact,
      description: newCreditScore.description,
      weight: this.NEW_CREDIT_WEIGHT,
    })

    // Calculate weighted score
    const weightedScore = factors.reduce((total, factor) => {
      return total + factor.impact * factor.weight
    }, 0)

    // Apply income adjustment if available
    const incomeAdjustment = annualIncome
      ? this.calculateIncomeAdjustment(annualIncome, creditData.totalCurrentDebt)
      : 0

    // Final score calculation (300-850 range)
    const rawScore = Math.round(300 + (weightedScore + incomeAdjustment) * 5.5)
    const finalScore = Math.max(300, Math.min(850, rawScore))

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(creditData)

    return {
      score: finalScore,
      grade: this.determineGrade(finalScore),
      factors,
      confidence,
    }
  }

  private calculatePaymentHistoryScore(creditData: TraditionalCreditData): { impact: number; description: string } {
    const baseScore = Number(creditData.paymentHistoryScore)
    let impact = baseScore

    // Penalize for delinquencies
    const delinquencyPenalty = Math.min(creditData.numberOfDelinquencies * 15, 50)
    impact -= delinquencyPenalty

    // Severe penalties for bankruptcies and foreclosures
    const bankruptcyPenalty = creditData.numberOfBankruptcies * 40
    const foreclosurePenalty = creditData.numberOfForeclosures * 35
    impact -= bankruptcyPenalty + foreclosurePenalty

    impact = Math.max(0, Math.min(100, impact))

    let description = "Payment history is the most important factor. "
    if (impact >= 90) {
      description += "Excellent payment history with no missed payments."
    } else if (impact >= 70) {
      description += "Good payment history with minor issues."
    } else if (impact >= 50) {
      description += "Fair payment history with some missed payments."
    } else {
      description += "Poor payment history with significant delinquencies."
    }

    return { impact, description }
  }

  private calculateCreditUtilizationScore(creditData: TraditionalCreditData): { impact: number; description: string } {
    const utilizationRatio = Number(creditData.creditUtilizationRatio)
    let impact: number

    // Optimal utilization scoring
    if (utilizationRatio <= 0.1) {
      impact = 100 // Under 10% is excellent
    } else if (utilizationRatio <= 0.3) {
      impact = 90 - (utilizationRatio - 0.1) * 100 // 90-70 for 10-30%
    } else if (utilizationRatio <= 0.5) {
      impact = 70 - (utilizationRatio - 0.3) * 75 // 70-55 for 30-50%
    } else if (utilizationRatio <= 0.7) {
      impact = 55 - (utilizationRatio - 0.5) * 75 // 55-40 for 50-70%
    } else {
      impact = Math.max(10, 40 - (utilizationRatio - 0.7) * 100) // Below 40 for >70%
    }

    let description = "Credit utilization measures how much of your available credit you're using. "
    if (impact >= 90) {
      description += "Excellent utilization - keeping balances low shows responsible credit management."
    } else if (impact >= 70) {
      description += "Good utilization - consider paying down balances to improve score."
    } else if (impact >= 50) {
      description += "High utilization - reducing credit card balances will significantly improve your score."
    } else {
      description += "Very high utilization - this is likely your biggest opportunity for score improvement."
    }

    return { impact, description }
  }

  private calculateCreditHistoryScore(creditData: TraditionalCreditData): { impact: number; description: string } {
    const historyLengthMonths = creditData.creditHistoryLengthMonths
    let impact: number

    // Credit history length scoring
    if (historyLengthMonths >= 120) {
      impact = 100 // 10+ years is excellent
    } else if (historyLengthMonths >= 84) {
      impact = 90 // 7-10 years is very good
    } else if (historyLengthMonths >= 60) {
      impact = 80 // 5-7 years is good
    } else if (historyLengthMonths >= 36) {
      impact = 65 // 3-5 years is fair
    } else if (historyLengthMonths >= 12) {
      impact = 45 // 1-3 years is limited
    } else {
      impact = 25 // Less than 1 year is very limited
    }

    const years = Math.floor(historyLengthMonths / 12)
    const months = historyLengthMonths % 12

    let description = `Credit history length: ${years} years and ${months} months. `
    if (impact >= 90) {
      description += "Excellent credit history length demonstrates long-term creditworthiness."
    } else if (impact >= 70) {
      description += "Good credit history length - continue building your credit profile."
    } else if (impact >= 50) {
      description += "Fair credit history - time will help improve this factor."
    } else {
      description += "Limited credit history - consider becoming an authorized user or keeping old accounts open."
    }

    return { impact, description }
  }

  private calculateCreditMixScore(creditData: TraditionalCreditData): { impact: number; description: string } {
    const creditMix = creditData.creditMixDetails || {}
    const totalAccounts = creditData.numberOfCreditAccounts

    // Count different types of credit
    const hasRevolvingCredit = (creditMix.creditCards || 0) > 0
    const hasInstallmentLoans =
      (creditMix.autoLoans || 0) + (creditMix.personalLoans || 0) + (creditMix.studentLoans || 0) > 0
    const hasMortgage = (creditMix.mortgages || 0) > 0

    let impact: number
    let diversityScore = 0

    if (hasRevolvingCredit) diversityScore += 40
    if (hasInstallmentLoans) diversityScore += 35
    if (hasMortgage) diversityScore += 25

    // Bonus for having multiple types
    const creditTypes = [hasRevolvingCredit, hasInstallmentLoans, hasMortgage].filter(Boolean).length
    if (creditTypes >= 3) {
      impact = Math.min(100, diversityScore + 15)
    } else if (creditTypes === 2) {
      impact = diversityScore
    } else {
      impact = Math.max(30, diversityScore - 20)
    }

    // Adjust based on total number of accounts
    if (totalAccounts < 3) {
      impact *= 0.8 // Reduce score for too few accounts
    } else if (totalAccounts > 20) {
      impact *= 0.9 // Slight reduction for too many accounts
    }

    let description = "Credit mix shows your ability to manage different types of credit. "
    if (impact >= 85) {
      description += "Excellent mix of credit types demonstrates financial responsibility."
    } else if (impact >= 65) {
      description += "Good credit mix - you have experience with multiple credit types."
    } else if (impact >= 45) {
      description += "Limited credit mix - consider diversifying your credit portfolio over time."
    } else {
      description += "Very limited credit mix - focus on building a diverse credit profile."
    }

    return { impact, description }
  }

  private calculateNewCreditScore(creditData: TraditionalCreditData): { impact: number; description: string } {
    const recentInquiries = creditData.numberOfRecentInquiries
    let impact: number

    // Recent inquiries scoring (last 12 months)
    if (recentInquiries === 0) {
      impact = 100
    } else if (recentInquiries <= 2) {
      impact = 85
    } else if (recentInquiries <= 4) {
      impact = 65
    } else if (recentInquiries <= 6) {
      impact = 45
    } else {
      impact = Math.max(20, 45 - (recentInquiries - 6) * 5)
    }

    let description = `${recentInquiries} recent credit inquiries. `
    if (impact >= 90) {
      description += "Excellent - no recent credit applications shows stability."
    } else if (impact >= 70) {
      description += "Good - minimal recent credit activity."
    } else if (impact >= 50) {
      description += "Fair - moderate recent credit activity may indicate credit seeking."
    } else {
      description += "Poor - high number of recent inquiries suggests credit seeking behavior."
    }

    return { impact, description }
  }

  private calculateIncomeAdjustment(annualIncome: number, totalDebt: number): number {
    if (!annualIncome || annualIncome <= 0) return 0

    const debtToIncomeRatio = totalDebt / annualIncome

    // Income adjustment based on debt-to-income ratio
    if (debtToIncomeRatio <= 0.2) {
      return 5 // Excellent DTI
    } else if (debtToIncomeRatio <= 0.36) {
      return 2 // Good DTI
    } else if (debtToIncomeRatio <= 0.5) {
      return -2 // Fair DTI
    } else {
      return -5 // Poor DTI
    }
  }

  private calculateConfidence(creditData: TraditionalCreditData): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence based on data completeness
    if (creditData.paymentHistoryScore > 0) confidence += 0.15
    if (creditData.creditUtilizationRatio >= 0) confidence += 0.15
    if (creditData.creditHistoryLengthMonths > 0) confidence += 0.1
    if (creditData.numberOfCreditAccounts > 0) confidence += 0.05
    if (creditData.creditMixDetails) confidence += 0.05

    // Reduce confidence for very new or very old data
    const dataAge =
      Math.abs(new Date().getTime() - new Date(creditData.dataSourceDate).getTime()) / (1000 * 60 * 60 * 24)
    if (dataAge > 90) {
      confidence *= 0.9 // Reduce confidence for data older than 90 days
    }

    return Math.min(1, confidence)
  }

  private determineGrade(score: number): CreditGrade {
    if (score >= 800) return CreditGrade.EXCELLENT
    if (score >= 740) return CreditGrade.VERY_GOOD
    if (score >= 670) return CreditGrade.GOOD
    if (score >= 580) return CreditGrade.FAIR
    if (score >= 500) return CreditGrade.POOR
    return CreditGrade.VERY_POOR
  }

  // Utility method to generate improvement suggestions
  generateImprovementSuggestions(factors: ScoreFactor[]): string[] {
    const suggestions: string[] = []

    factors.forEach((factor) => {
      if (factor.impact < 70) {
        switch (factor.category) {
          case "Payment History":
            suggestions.push("Make all payments on time - even one missed payment can significantly impact your score")
            suggestions.push("Set up automatic payments to ensure you never miss a due date")
            break
          case "Credit Utilization":
            suggestions.push("Pay down credit card balances to below 30% of credit limits")
            suggestions.push("Consider making multiple payments per month to keep balances low")
            suggestions.push("Request credit limit increases to improve utilization ratio")
            break
          case "Credit History Length":
            suggestions.push("Keep old credit accounts open to maintain credit history length")
            suggestions.push("Avoid closing your oldest credit cards")
            break
          case "Credit Mix":
            suggestions.push("Consider diversifying your credit portfolio with different types of loans")
            suggestions.push("A mix of credit cards and installment loans can improve your score")
            break
          case "New Credit":
            suggestions.push("Limit new credit applications - only apply when necessary")
            suggestions.push("Space out credit applications over time")
            break
        }
      }
    })

    return suggestions
  }
}
