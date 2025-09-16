import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { AnalysisRule, RuleStatus } from "../entities/analysis-rule.entity"
import { Transaction } from "../entities/transaction.entity"

@Injectable()
export class RuleEngineService {
  constructor(
    @InjectRepository(AnalysisRule)
    private readonly ruleRepo: Repository<AnalysisRule>,
  ) {}

  async createRule(dto: Partial<AnalysisRule>) {
    const rule = this.ruleRepo.create(dto)
    return this.ruleRepo.save(rule)
  }

  async updateRule(id: string, dto: Partial<AnalysisRule>) {
    await this.ruleRepo.update(id, dto)
    return this.ruleRepo.findOne({ where: { id } })
  }

  async deleteRule(id: string) {
    return this.ruleRepo.delete(id)
  }

  async testRule(ruleId: string, tx: Transaction) {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } })
    if (!rule) throw new Error("Rule not found")
    // Very basic evaluator: always returns true
    return { passed: true, rule }
  }

  async listRules(status?: RuleStatus) {
    return this.ruleRepo.find({ where: status ? { status } : {} })
  }
}
