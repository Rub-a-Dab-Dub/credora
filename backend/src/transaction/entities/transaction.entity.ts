import { BankAccount } from 'src/banking/entities/bank-account.entity';
import { TransactionAnalysis } from "../../transaction-analysis/entities/transaction-analysis.entity"
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm'

export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column()
  providerTransactionId: string

  @ManyToOne(() => BankAccount, { nullable: true })
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount?: BankAccount

  @Column({ nullable: true })
  bankAccountId?: string

  // date stored as ISO string or date
  @Column({ type: 'timestamptz', nullable: true })
  transactionDate?: string


  @Column({ name: "user_id" })
  userId: string


  @Column('decimal', { precision: 18, scale: 2, nullable: true })
  amount?: number

  @Column({ nullable: true })
  currency?: string

  @Column({ nullable: true })
  merchantName?: string

  @Column({ nullable: true })
  merchantCategory?: string

  @Column({ nullable: true })
  rawDescription?: string

  @Column({ nullable: true })
  description?: string

  @Column({ nullable: true })
  category?: string

  @Column({ nullable: true })
  channel?: string

  @Column({ nullable: true })
  location?: string

  @Column({ type: 'enum', enum: TransactionType, nullable: true })
  type?: TransactionType

  @Column({ default: false })
  pending?: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date

  // Relation back to analyses
  @OneToMany(() => TransactionAnalysis, (analysis) => analysis.transaction)
  analyses?: TransactionAnalysis[]
}