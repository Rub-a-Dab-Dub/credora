// src/screening/entities/screening-result.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";
@Entity('screening_results')
export class ScreeningResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityId: string; // user ID or entity being screened

  @Column()
  entityType: string; // 'user', 'company', etc.

  @Column({ type: 'jsonb' })
  screeningData: any; // data that was screened

  @Column()
  overallRiskScore: number; // 0-100

  @Column()
  status: string; // 'clear', 'potential_match', 'blocked'

  @Column({ type: 'jsonb' })
  matches: any[]; // array of match details

  @Column({ default: false })
  isFalsePositive: boolean;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  screenedAt: Date;
}
