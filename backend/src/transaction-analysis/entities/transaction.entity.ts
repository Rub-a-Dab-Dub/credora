import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TransactionAnalysis } from '../../transaction-analysis/entities/transaction-analysis.entity';
import { BankAccount } from '../../banking/entities/bank-account.entity';

export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
  TRANSFER = 'transfer',
  REFUND = 'refund',
  FEE = 'fee',
}

@Entity({ name: 'transactions' })
@Index(['userId', 'transactionDate'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The app-level user id that owns this transaction
  @Column()
  @Index()
  userId: string;

  // Provider-specific transaction id (plaid / other)
  @Column({ nullable: true })
  providerTransactionId?: string;

  // Which bank account (local id) this transaction belongs to (optional)
  @Column({ nullable: true })
  bankAccountId?: string;

  // Cash in / out / transfer
  @Column({ type: 'enum', enum: TransactionType, default: TransactionType.DEBIT })
  type: TransactionType;

  // Monetary amount (positive numbers; semantics depend on `type`)
  @Column('decimal', { precision: 18, scale: 2 })
  amount: number;

  // Currency code
  @Column({ default: 'USD' })
  currency: string;

  // Human-friendly merchant name
  @Column({ nullable: true })
  merchantName?: string;

  // Category assigned (eg. groceries, dining, utilities)
  @Column({ nullable: true })
  category?: string;

  // Merchant MCC or category string (if provided by provider)
  @Column({ nullable: true })
  merchantCategory?: string;

  // A more verbose/raw description returned by provider
  @Column({ nullable: true })
  rawDescription?: string;

  // Short description field used in some services
  @Column({ nullable: true })
  description?: string;

  // Location details (city/country / or geo JSON)
  @Column({ nullable: true })
  location?: string;

  // Channel used (card, ach, atm, online, pos, mobile)
  @Column({ nullable: true })
  channel?: string;

  // The canonical timestamp of the transaction (provider date)
  @Column({ type: 'timestamp', name: 'transaction_date' })
  transactionDate: Date;

  // Flags
  @Column({ default: false })
  pending: boolean;

  // For audit / mapping to raw provider tokens
  @Column({ nullable: true })
  provider: string;
  
  //Transaction Type (credit, debit, etc.)
  @Column({ nullable: true })
  accountId?: string; // external reference to bank account

  // Soft metadata
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // relations
  @ManyToOne(() => BankAccount, (acct) => acct.id, { nullable: true, onDelete: 'SET NULL' })
  bankAccount?: BankAccount;

  @OneToMany(() => TransactionAnalysis, (analysis) => analysis.transaction, { cascade: true })
  analyses?: TransactionAnalysis[];
}
