import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

export enum RuleStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum RuleType {
  FRAUD = "fraud",
  CASH_FLOW = "cash_flow",
  CATEGORIZATION = "categorization",
}

@Entity("analysis_rules")
export class AnalysisRule {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ type: "enum", enum: RuleType })
  type: RuleType

  @Column("jsonb")
  conditions: Record<string, any>

  @Column("jsonb")
  actions: Record<string, any>

  @Column({ type: "enum", enum: RuleStatus, default: RuleStatus.ACTIVE })
  status: RuleStatus

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
