import { Test, type TestingModule } from "@nestjs/testing"
import { TransactionAnalysisController } from "../transaction-analysis.controller"
import { TransactionAnalysisService } from "../../services/transaction-analysis.service"

describe("TransactionAnalysisController", () => {
  let controller: TransactionAnalysisController
  let service: TransactionAnalysisService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionAnalysisController],
      providers: [
        {
          provide: TransactionAnalysisService,
          useValue: {
            analyzeTransaction: jest.fn(),
            analyzeUserTransactions: jest.fn(),
            calculateCreditScore: jest.fn(),
            getAnalysisHistory: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<TransactionAnalysisController>(TransactionAnalysisController)
    service = module.get<TransactionAnalysisService>(TransactionAnalysisService)
  })

  describe("analyzeTransaction", () => {
    it("should analyze single transaction", async () => {
      const transactionId = "tx-1"
      const mockAnalysis = {
        id: "1",
        transactionId,
        category: "FOOD_DINING",
        riskScore: 0.2,
        fraudScore: 0.1,
      }

      ;(service.analyzeTransaction as jest.Mock).mockResolvedValue(mockAnalysis)

      const result = await controller.analyzeTransaction(transactionId)

      expect(result).toEqual(mockAnalysis)
      expect(service.analyzeTransaction).toHaveBeenCalledWith(transactionId)
    })
  })

  describe("analyzeUserTransactions", () => {
    it("should analyze all user transactions", async () => {
      const userId = "user-1"
      const mockAnalysis = {
        userId,
        totalTransactions: 10,
        spendingPatterns: {},
        riskAssessment: {},
      }

      ;(service.analyzeUserTransactions as jest.Mock).mockResolvedValue(mockAnalysis)

      const result = await controller.analyzeUserTransactions(userId)

      expect(result).toEqual(mockAnalysis)
      expect(service.analyzeUserTransactions).toHaveBeenCalledWith(userId)
    })
  })

  describe("getCreditScore", () => {
    it("should calculate and return credit score", async () => {
      const userId = "user-1"
      const mockScore = {
        score: 750,
        factors: ["Payment history", "Credit utilization"],
        recommendations: ["Pay bills on time"],
      }

      ;(service.calculateCreditScore as jest.Mock).mockResolvedValue(mockScore)

      const result = await controller.getCreditScore(userId)

      expect(result).toEqual(mockScore)
      expect(service.calculateCreditScore).toHaveBeenCalledWith(userId)
    })
  })
})
