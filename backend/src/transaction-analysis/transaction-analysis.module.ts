import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"

// Entities
import { Transaction } from "./entities/transaction.entity"

import {TransactionAnalysis, UserFinancialProfile, AnalysisRule } from "./entities"

// Services
import { TransactionAnalysisService } from "./services/transaction-analysis.service"
import { CategorizationService } from "./services/categorization.service"
//import { SpendingPatternService } from "./services/spending-pattern.service"
import { IncomeStabilityService } from "./services/income-stability.service"
import { CashFlowService } from "./services/cash-flow.service"
//import { BehavioralScoringService } from "./services/behavioral-scoring.service"
import { FraudDetectionService } from "./services/fraud-detection.service"
//import { RiskAssessmentService } from "./services/risk-assessment.service"
import { TimeSeriesAnalysisService } from "./services/time-series-analysis.service"
import { RuleEngineService } from "./services/rule-engine.service"
//import { RuleConditionEvaluator } from "./services/rule-condition-evaluator.service"
//import { RuleActionExecutor } from "./services/rule-action-executor.service"

// Controllers
import { TransactionAnalysisController } from "./controllers/transaction-analysis.controller"
import { RuleManagementController } from "./controllers/rule-management.controller"
import { UserProfileController } from "./controllers/user-profile.controller"

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, TransactionAnalysis, UserFinancialProfile, AnalysisRule])],
  controllers: [TransactionAnalysisController, RuleManagementController, UserProfileController],
  providers: [
    // Core Analysis Services
    TransactionAnalysisService,
    CategorizationService,
    //SpendingPatternService,
    IncomeStabilityService,
    CashFlowService,
    //BehavioralScoringService,
    FraudDetectionService,
    //RiskAssessmentService,
    TimeSeriesAnalysisService,

    // Rule Engine Services
    RuleEngineService,
    //RuleConditionEvaluator,
    //RuleActionExecutor,
  ],
  exports: [
    TransactionAnalysisService,
    RuleEngineService,
    CategorizationService,
    FraudDetectionService,
    //RiskAssessmentService,
  ],
})
export class TransactionAnalysisModule {}
