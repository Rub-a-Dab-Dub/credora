import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from "typeorm"
import { Transaction } from "./transaction.entity"

export enum TransactionType {
  DEBIT = "debit",
  CREDIT = "credit",
  TRANSFER = "transfer",
  PAYMENT = "payment",
  REFUND = "refund",
  FEE = "fee",
  INTEREST = "interest",
  OTHER = "other",
}


export enum AnalysisType {
  CATEGORIZATION = "categorization",
  CASH_FLOW = "cash_flow",
  INCOME_STABILITY = "income_stability",
  SPENDING_PATTERN = "spending_pattern",
  BEHAVIORAL_SCORING = "behavioral_scoring",
  FRAUD_DETECTION = "fraud_detection",
  RISK_ASSESSMENT = "risk_assessment",
  TIME_SERIES = "time_series",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

@Entity("transaction_analyses")
@Index(["transactionId", "type"])
@Index(["userId", "createdAt"])
export class TransactionAnalysis {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "transaction_id" })
  transactionId: string

  @Column({ name: "user_id" })
  userId: string

  @Column({ type: "enum", enum: AnalysisType })
  type: AnalysisType

  @Column({ type: "decimal", precision: 5, scale: 4, nullable: true })
  score?: number

  @Column({ type: "decimal", precision: 5, scale: 4, default: 0.5 })
  confidence: number

  @Column({ type: "enum", enum: RiskLevel, default: RiskLevel.LOW, name: "risk_level" })
  riskLevel: RiskLevel

  @Column({ type: "jsonb", nullable: true })
  data?: Record<string, any>

 
  @ManyToOne(() => Transaction, (tx) => (tx as any).analyses, { onDelete: "CASCADE" })
  transaction: Transaction

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date
}


