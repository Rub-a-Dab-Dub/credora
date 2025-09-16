import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm"
import { Transaction } from "./transaction.entity"

@Entity("user_financial_profiles")
export class UserFinancialProfile {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  userId: string // external reference to auth system

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  income: number

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  expenses: number

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  savings: number

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  debt: number

  @Column({ type: "jsonb", nullable: true })
  financialGoals: Record<string, any>

  @Column({ nullable: true })
  incomeStability?: string;

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  debtToIncomeRatio?: number;

  @Column({ nullable: true })
  spendingBehavior?: string;

  @Column({ type: "int", nullable: true })
  riskScore?: number;

  @Column({ type: "int", nullable: true })
  fraudScore?: number;
  
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  monthlyIncome?: number

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  monthlyExpenses?: number

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date

  @OneToMany(() => Transaction, (transaction) => transaction.userId, { cascade: true })
  transactions: Transaction[]
}
