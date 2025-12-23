// src/screening/screening.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScreeningService } from './services/screening.service';
import { WatchlistService } from './services/watchlist.service';
import { FuzzyMatchingService } from './services/fuzzy-matching.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { ScreeningProcessor } from './processors/screening.processor';
import { ScreeningController } from './controllers/screening.controller';
import { Watchlist } from './entities/watchlist.entity';
import { ScreeningResult } from './entities/screening-result.entity';
import { ScreeningMatch } from './entities/screening-match.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([Watchlist, ScreeningResult, ScreeningMatch]),
    BullModule.registerQueue({
      name: 'screening-queue',
    }),
  ],
  providers: [
    ScreeningService,
    WatchlistService,
    FuzzyMatchingService,
    RiskScoringService,
    ScreeningProcessor,
  ],
  controllers: [ScreeningController],
  exports: [ScreeningService],
})
export class ScreeningModule {}
