// src/screening/entities/watchlist.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
@Entity('watchlists')
export class Watchlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // OFAC, PEP, Adverse Media, Custom

  @Column()
  type: string; // sanctions, pep, adverse_media, custom

  @Column()
  source: string; // data source identifier

  @Column({ type: 'jsonb' })
  data: any; // flexible data storage

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
