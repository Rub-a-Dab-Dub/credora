import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { IsOptional, IsString, IsBoolean, IsObject } from 'class-validator';
import { Exclude } from 'class-transformer';
import { RefreshToken } from './refresh-token.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  // Encrypted PII fields
  @Column({ type: 'varchar', nullable: true })
  encryptedFullName: string;

  @Column({ type: 'varchar', nullable: true })
  encryptedEmail: string;

  // Wallet linking
  @Column({ type: 'varchar', nullable: true })
  walletAddress: string;

  // Profile completion tracking
  @Column({ default: false })
  profileCompleted: boolean;

  // User preferences (JSON)
  @Column({ type: 'json', nullable: true })
  preferences: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: Date;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true })
  @Exclude()
  twoFactorSecret: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];
}
