import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BankToken } from './bank-token.entity';

@Entity({ name: 'bank_accounts' })
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index() // queries by providerAccountId will be faster
  @Column({ type: 'varchar', nullable: false, unique: true })
  providerAccountId: string; // provider-specific account id (e.g. Plaid account_id)

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  mask?: string;

  @Column({ type: 'varchar', nullable: true })
  type?: string;

  @Column({ type: 'varchar', nullable: true })
  subtype?: string;

  @Column('decimal', { precision: 18, scale: 2, nullable: true })
  currentBalance?: number;

  @Column('decimal', { precision: 18, scale: 2, nullable: true })
  availableBalance?: number;

  @ManyToOne(() => BankToken, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bankTokenId' })
  bankToken?: BankToken;

  @Column({ type: 'uuid', nullable: true })
  bankTokenId?: string;
}
