import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, MoreThanOrEqual } from "typeorm"

import { RuleEngineService } from "../services/rule-engine.service"
import { CreateRuleDto, UpdateRuleDto, RuleTestDto, EXAMPLE_RULES } from "../dto/rule.dto"
import { AnalysisRule } from "../entities/analysis-rule.entity"
import { Transaction } from "../entities/transaction.entity"
import { RuleType, RuleStatus } from "../entities"

@ApiTags("Rule Management")
@Controller("rules")
export class RuleManagementController {
  private readonly logger = new Logger(RuleManagementController.name)

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @InjectRepository(AnalysisRule)
    private readonly ruleRepository: Repository<AnalysisRule>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new analysis rule" })
  @ApiResponse({ status: 201, description: "Rule created successfully", type: AnalysisRule })
  @ApiResponse({ status: 400, description: "Invalid rule configuration" })
  async createRule(@Body() createRuleDto: CreateRuleDto): Promise<AnalysisRule> {
    try {
      this.logger.log(`Creating new rule: ${createRuleDto.name}`)
      const rule = await this.ruleEngineService.createRule(createRuleDto)
      this.logger.log(`Successfully created rule ${rule.id}: ${rule.name}`)
      return rule
    } catch (error) {
      this.logger.error(`Error creating rule ${createRuleDto.name}:`, error)
      if (error.message.includes("validation") || error.message.includes("required")) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
      }
      throw new HttpException("Failed to create rule", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get()
  @ApiOperation({ summary: "Get all analysis rules" })
  @ApiResponse({ status: 200, description: "Rules retrieved successfully", type: [AnalysisRule] })
  async getAllRules(
    @Query("ruleType") ruleType?: RuleType,
    @Query("status") status?: RuleStatus,
  ): Promise<AnalysisRule[]> {
    try {
      const whereClause: any = {}
      if (ruleType) whereClause.ruleType = ruleType
      if (status) whereClause.status = status

      const rules = await this.ruleRepository.find({
        where: whereClause,
        order: { createdAt: "DESC" }, // removed priority unless you add it
      })

      return rules
    } catch (error) {
      this.logger.error("Error retrieving rules:", error)
      throw new HttpException("Failed to retrieve rules", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(":ruleId")
  @ApiOperation({ summary: "Get a specific rule by ID" })
  @ApiParam({ name: "ruleId", description: "Rule ID" })
  async getRule(@Param("ruleId") ruleId: string): Promise<AnalysisRule> {
    const rule = await this.ruleRepository.findOne({ where: { id: ruleId } })
    if (!rule) throw new HttpException("Rule not found", HttpStatus.NOT_FOUND)
    return rule
  }

  @Put(":ruleId")
  @ApiOperation({ summary: "Update an existing rule" })
  @ApiParam({ name: "ruleId", description: "Rule ID" })
  async updateRule(@Param("ruleId") ruleId: string, @Body() updateRuleDto: UpdateRuleDto): Promise<AnalysisRule> {
    const rule = await this.ruleEngineService.updateRule(ruleId, updateRuleDto)
    if (!rule) throw new HttpException("Rule not found", HttpStatus.NOT_FOUND)
    return rule
  }

  @Delete(":ruleId")
  @ApiOperation({ summary: "Delete a rule (mark as inactive)" })
  async deleteRule(@Param("ruleId") ruleId: string): Promise<{ message: string }> {
    await this.ruleEngineService.deleteRule(ruleId)
    return { message: "Rule deleted successfully" }
  }

  @Post(":ruleId/test")
  @ApiOperation({ summary: "Test a rule against a transaction" })
  async testRule(@Param("ruleId") ruleId: string, @Body() testDto: RuleTestDto): Promise<any> {
    const transaction = await this.transactionRepository.findOne({ where: { id: testDto.transactionId } })
    if (!transaction) throw new HttpException("Transaction not found", HttpStatus.NOT_FOUND)

    let historicalTransactions: Transaction[] = []
    if (testDto.includeHistorical) {
      const timeRangeMonths = testDto.timeRangeMonths || 12
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - timeRangeMonths)

      historicalTransactions = await this.transactionRepository.find({
        where: {
          userId: transaction.userId,
          transactionDate: MoreThanOrEqual(startDate),
        },
        order: { transactionDate: "DESC" },
      })
    }

    return this.ruleEngineService.testRule(ruleId, transaction)
  }

  @Post(":ruleId/activate")
  async activateRule(@Param("ruleId") ruleId: string): Promise<{ message: string }> {
    await this.ruleEngineService.updateRule(ruleId, { status: RuleStatus.ACTIVE })
    return { message: "Rule activated successfully" }
  }

  @Post(":ruleId/deactivate")
  async deactivateRule(@Param("ruleId") ruleId: string): Promise<{ message: string }> {
    await this.ruleEngineService.updateRule(ruleId, { status: RuleStatus.INACTIVE })
    return { message: "Rule deactivated successfully" }
  }

  @Get("examples/templates")
  async getRuleTemplates(): Promise<any> {
    return EXAMPLE_RULES
  }
}
