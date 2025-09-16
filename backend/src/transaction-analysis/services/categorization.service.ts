import { Injectable, Logger } from "@nestjs/common"
import { Transaction } from "../entities/transaction.entity";
import { TransactionAnalysis, AnalysisType, RiskLevel } from "../entities/transaction-analysis.entity";
import { TransactionType } from "../entities/transaction-analysis.entity"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"

export interface CategorizationResult {
  transactionId: string
  userId: string
  analysisType: AnalysisType.CATEGORIZATION
  confidence: number
  riskLevel: RiskLevel
  score: number
  result: {
    category: string
    subcategory: string
    categoryConfidence: number
    alternativeCategories: Array<{ category: string; confidence: number }>
  }
  features: Record<string, any>
  modelVersion: string
  insights: string[]
  recommendations: string[]
}

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name)
  
  constructor(
      @InjectRepository(Transaction)
      private readonly txRepo: Repository<Transaction>,
      @InjectRepository(TransactionAnalysis)
      private readonly analysisRepo: Repository<TransactionAnalysis>,
    ) {}


  // Predefined category mappings for merchant-based categorization
  private readonly merchantCategories = {
    // Food & Dining
    "McDonald's": { category: "Food & Dining", subcategory: "Fast Food" },
    Starbucks: { category: "Food & Dining", subcategory: "Coffee Shops" },
    "Uber Eats": { category: "Food & Dining", subcategory: "Food Delivery" },

    // Shopping
    Amazon: { category: "Shopping", subcategory: "Online Shopping" },
    Walmart: { category: "Shopping", subcategory: "Groceries" },
    Target: { category: "Shopping", subcategory: "Department Stores" },

    // Transportation
    Uber: { category: "Transportation", subcategory: "Ride Sharing" },
    Shell: { category: "Transportation", subcategory: "Gas Stations" },

    // Utilities
    "Electric Company": { category: "Bills & Utilities", subcategory: "Electricity" },
    "Water Department": { category: "Bills & Utilities", subcategory: "Water" },

    // Entertainment
    Netflix: { category: "Entertainment", subcategory: "Streaming Services" },
    Spotify: { category: "Entertainment", subcategory: "Music" },
  }

  // Keyword-based categorization rules
  private readonly categoryKeywords = {
    "Food & Dining": [
      "restaurant",
      "cafe",
      "pizza",
      "burger",
      "food",
      "dining",
      "kitchen",
      "grill",
      "bar",
      "pub",
      "bakery",
      "deli",
      "coffee",
      "tea",
    ],
    Shopping: [
      "store",
      "shop",
      "market",
      "mall",
      "retail",
      "clothing",
      "fashion",
      "electronics",
      "books",
      "pharmacy",
      "drugstore",
    ],
    Transportation: [
      "gas",
      "fuel",
      "parking",
      "taxi",
      "uber",
      "lyft",
      "bus",
      "train",
      "airline",
      "flight",
      "car",
      "auto",
      "repair",
    ],
    "Bills & Utilities": [
      "electric",
      "water",
      "gas",
      "internet",
      "phone",
      "cable",
      "insurance",
      "rent",
      "mortgage",
      "utility",
      "bill",
    ],
    Entertainment: [
      "movie",
      "theater",
      "cinema",
      "game",
      "sport",
      "gym",
      "fitness",
      "music",
      "streaming",
      "subscription",
    ],
    Healthcare: ["hospital", "doctor", "medical", "pharmacy", "health", "dental", "clinic", "medicine", "prescription"],
    Education: ["school", "university", "college", "education", "tuition", "books", "learning", "course"],
    Travel: ["hotel", "motel", "travel", "vacation", "trip", "booking", "airbnb"],
  }

  async categorizeTransaction(
    transaction: Transaction,
    historicalTransactions: Transaction[],
  ): Promise<CategorizationResult> {
    this.logger.log(`Categorizing transaction ${transaction.id}`)

    // Extract features for ML model
    const features = this.extractFeatures(transaction, historicalTransactions)

    // Apply rule-based categorization
    const ruleBasedResult = this.applyRuleBasedCategorization(transaction)

    // Apply ML-based categorization (simulated)
    const mlResult = await this.applyMLCategorization(transaction, features)

    // Combine results with confidence weighting
    const finalResult = this.combineCategorizationResults(ruleBasedResult, mlResult)

    // Generate insights and recommendations
    const insights = this.generateInsights(transaction, finalResult, historicalTransactions)
    const recommendations = this.generateRecommendations(transaction, finalResult)

    return {
      transactionId: transaction.id,
      userId: transaction.userId,
      analysisType: AnalysisType.CATEGORIZATION,
      confidence: finalResult.confidence,
      riskLevel: this.assessRiskLevel(finalResult),
      score: finalResult.confidence * 100,
      result: {
        category: finalResult.category,
        subcategory: finalResult.subcategory,
        categoryConfidence: finalResult.confidence,
        alternativeCategories: finalResult.alternatives,
      },
      features,
      modelVersion: "1.0.0",
      insights,
      recommendations,
    }
  }
  async categorize(transaction: Transaction): Promise<TransactionAnalysis> {
    const historical = await this.txRepo.find({ where: { bankAccountId: transaction.bankAccountId } })

    const result = await this.categorizeTransaction(transaction, historical)

    const analysis = this.analysisRepo.create({
      transactionId: transaction.id,
      userId: transaction.bankAccount?.id || "unknown", // adjust if you store userId elsewhere
      type: AnalysisType.CATEGORIZATION,
      confidence: result.confidence,
      riskLevel: result.riskLevel,
      score: result.score,
      data: result, // store full result JSON
      transaction,
    })

    return this.analysisRepo.save(analysis)
  }


  private extractFeatures(transaction: Transaction, historicalTransactions: Transaction[]): Record<string, any> {
    return {
      amount: Number(transaction.amount),
      merchantName: transaction.merchantName?.toLowerCase() || "",
      description: transaction.description?.toLowerCase() || "",
      channel: transaction.channel,
      timeOfDay: new Date(transaction.transactionDate).getHours(),
      dayOfWeek: new Date(transaction.transactionDate).getDay(),
      location: transaction.location || "",
      merchantCategory: transaction.merchantCategory || "",
      historicalCategoryFrequency: this.getHistoricalCategoryFrequency(
        transaction.merchantName || "",
        historicalTransactions,
      ),
      amountRange: this.getAmountRange(Number(transaction.amount)),
      isWeekend: [0, 6].includes(new Date(transaction.transactionDate).getDay()),
    }
  }

  private applyRuleBasedCategorization(transaction: Transaction): any {
    // Check merchant-based categorization first
    if (transaction.merchantName) {
      const merchantMatch = this.merchantCategories[transaction.merchantName]
      if (merchantMatch) {
        return {
          category: merchantMatch.category,
          subcategory: merchantMatch.subcategory,
          confidence: 0.95,
          method: "merchant_mapping",
          alternatives: [],
        }
      }
    }

    // Check keyword-based categorization
    const text = `${transaction.merchantName || ""} ${transaction.description || ""}`.toLowerCase()
    const categoryScores = {}

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      let score = 0
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 1
        }
      }
      if (score > 0) {
        categoryScores[category] = score / keywords.length
      }
    }

    if (Object.keys(categoryScores).length > 0) {
      const sortedCategories = Object.entries(categoryScores).sort(([, a], [, b]) => (b as number) - (a as number))

      const topCategory = sortedCategories[0]
      const alternatives = sortedCategories.slice(1, 4).map(([cat, score]) => ({
        category: cat,
        confidence: score as number,
      }))

      return {
        category: topCategory[0],
        subcategory: "General",
        confidence: Math.min(topCategory[1] as number, 0.8),
        method: "keyword_matching",
        alternatives,
      }
    }

    // Default categorization
    return {
      category: "Other",
      subcategory: "Uncategorized",
      confidence: 0.3,
      method: "default",
      alternatives: [],
    }
  }

  private async applyMLCategorization(transaction: Transaction, features: Record<string, any>): Promise<any> {
    // Simulated ML model prediction
    // In a real implementation, this would call an actual ML model

    const predictions = [
      { category: "Food & Dining", confidence: 0.7 },
      { category: "Shopping", confidence: 0.2 },
      { category: "Transportation", confidence: 0.1 },
    ]

    const topPrediction = predictions[0]

    return {
      category: topPrediction.category,
      subcategory: "ML Predicted",
      confidence: topPrediction.confidence,
      method: "ml_model",
      alternatives: predictions.slice(1),
    }
  }

  private combineCategorizationResults(ruleResult: any, mlResult: any): any {
    // Weight rule-based results higher if confidence is high
    if (ruleResult.confidence > 0.8) {
      return ruleResult
    }

    // If both have similar confidence, prefer rule-based
    if (Math.abs(ruleResult.confidence - mlResult.confidence) < 0.2) {
      return ruleResult
    }

    // Otherwise, use the one with higher confidence
    return ruleResult.confidence > mlResult.confidence ? ruleResult : mlResult
  }

  private getHistoricalCategoryFrequency(
    merchantName: string,
    historicalTransactions: Transaction[],
  ): Record<string, number> {
    const frequency = {}

    historicalTransactions
      .filter((t) => t.merchantName === merchantName && t.category)
      .forEach((t) => {
        frequency[t.category|| "uncategorized"] = (frequency[t.category|| "uncategorized"] || 0) + 1
      })

    return frequency
  }

  private getAmountRange(amount: number): string {
    if (amount < 10) return "micro"
    if (amount < 50) return "small"
    if (amount < 200) return "medium"
    if (amount < 1000) return "large"
    return "very_large"
  }

  private assessRiskLevel(result: any): RiskLevel {
    if (result.confidence > 0.8) return RiskLevel.LOW
    if (result.confidence > 0.6) return RiskLevel.MEDIUM
    return RiskLevel.HIGH
  }

  private generateInsights(transaction: Transaction, result: any, historicalTransactions: Transaction[]): string[] {
    const insights:string[] = []

    if (result.confidence < 0.5) {
      insights.push("Low confidence in category prediction - manual review recommended")
    }

    const similarTransactions = historicalTransactions.filter((t) => t.merchantName === transaction.merchantName)

    if (similarTransactions.length > 0) {
      insights.push(`Found ${similarTransactions.length} similar transactions with this merchant`)
    }

    return insights
  }

  private generateRecommendations(transaction: Transaction, result: any): string[] {
    const recommendations:string[] = []

    if (result.confidence < 0.7) {
      recommendations.push("Consider adding merchant category information for better accuracy")
    }

    if (result.category === "Other") {
      recommendations.push("Review transaction details to improve categorization")
    }

    return recommendations
  }
}
