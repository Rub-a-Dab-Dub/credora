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
import * as crypto from 'crypto';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  ANALYST = 'analyst',
  OPERATOR = 'operator',
}

// Simple example helpers — replace with proper encryption key handling
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'default_32_characters_key_123456'; // must be 32 chars
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  if (!text) return '';
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

  get email(): string {
    return decrypt(this.encryptedEmail);
  }

  set email(value: string) {
    this.encryptedEmail = encrypt(value);
  }

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
