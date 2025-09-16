// src/screening/services/screening.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScreeningResult } from '../entities/screening-result.entity';
import { ScreeningMatch } from '../entities/screening-match.entity';
import { WatchlistService } from './watchlist.service';
import { Watchlist } from '../entities/watchlist.entity';
import { FuzzyMatchingService } from './fuzzy-matching.service';
import { RiskScoringService } from './risk-scoring.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ScreeningService {
  constructor(
    @InjectRepository(ScreeningResult)
    private screeningResultRepository: Repository<ScreeningResult>,
    @InjectRepository(ScreeningMatch)
    private screeningMatchRepository: Repository<ScreeningMatch>,
    private watchlistService: WatchlistService,
    private fuzzyMatchingService: FuzzyMatchingService,
    private riskScoringService: RiskScoringService,
    @InjectQueue('screening-queue') private screeningQueue: Queue,
  ) {}

  async screenEntity(
    entityId: string,
    entityType: string,
    screeningData: any,
  ): Promise<string> {
    // Add to queue for batch processing
    const job = await this.screeningQueue.add('screen-entity', {
      entityId,
      entityType,
      screeningData,
    });

    return job.id.toString();
  }

  async performScreening(
    entityId: string,
    entityType: string,
    screeningData: any,
  ): Promise<ScreeningResult> {
    // Get all watchlists
    const watchlists = await this.watchlistService.getAllWatchlists();

    // Perform screening against each watchlist
    const allMatches: {
      entry: number;
      score: number;
      matchedField: string;
      watchlistId: string;
      watchlistType: string;
    }[] = [];
    //const allMatches = [];

    for (const watchlist of watchlists) {
      const matches = await this.screenAgainstWatchlist(
        screeningData,
        watchlist,
      );
      allMatches.push(...matches);
    }

    // Calculate risk score
    const riskScore = this.riskScoringService.calculateRiskScore(allMatches);
    const status = this.riskScoringService.determineStatus(
      riskScore,
      allMatches,
    );

    // Save screening result
    const screeningResult = this.screeningResultRepository.create({
      entityId,
      entityType,
      screeningData,
      overallRiskScore: riskScore,
      status,
      matches: allMatches,
    });

    const savedResult = await this.screeningResultRepository.save(
      screeningResult,
    );

    // Save individual matches
    for (const match of allMatches) {
      const screeningMatch = this.screeningMatchRepository.create({
        screeningResult: savedResult,
        watchlistId: match.watchlistId,
        matchedField: match.matchedField,
        matchScore: match.score,
        matchDetails: match,
        riskLevel: this.riskScoringService.determineRiskLevel(match.score),
      });

      await this.screeningMatchRepository.save(screeningMatch);
    }

    return savedResult;
  }

  private async screenAgainstWatchlist(
    screeningData: any,
    watchlist: Watchlist,
  ): Promise<any[]> {
    const searchTerms = this.extractSearchTerms(screeningData);
    const matches = [];

    for (const term of searchTerms) {
      const watchlistMatches = this.fuzzyMatchingService.findMatches(
        term.value,
        [watchlist.data], // Assuming watchlist.data contains the entries
        75, // threshold
      );

      const matches: any[] = [];

      for (const match of watchlistMatches) {
        matches.push({
          ...match,
          watchlistId: watchlist.id,
          watchlistType: watchlist.type,
          matchedField: term.field,
        });
      }
    }

    return matches;
  }

  private extractSearchTerms(
    screeningData: any,
  ): Array<{ field: string; value: string }> {
    const terms: { field: string; value: string }[] = [];

    if (screeningData.firstName) {
      terms.push({ field: 'firstName', value: screeningData.firstName });
    }
    if (screeningData.lastName) {
      terms.push({ field: 'lastName', value: screeningData.lastName });
    }
    if (screeningData.fullName) {
      terms.push({ field: 'fullName', value: screeningData.fullName });
    }
    if (screeningData.passportNumber) {
      terms.push({
        field: 'passportNumber',
        value: screeningData.passportNumber,
      });
    }

    return terms;
  }

  async getScreeningResult(id: string): Promise<ScreeningResult | null> {
    return this.screeningResultRepository.findOne({
      where: { id },
      relations: ['matches'],
    });
  }

  async markAsFalsePositive(
    id: string,
    reviewedBy: string,
    notes: string,
  ): Promise<ScreeningResult | null> {
    await this.screeningResultRepository.update(id, {
      isFalsePositive: true,
      reviewedBy,
      reviewNotes: notes,
    });

    return this.getScreeningResult(id);
  }

  async getScreeningHistory(entityId: string): Promise<ScreeningResult[]> {
    return this.screeningResultRepository.find({
      where: { entityId },
      order: { screenedAt: 'DESC' },
    });
  }
}
