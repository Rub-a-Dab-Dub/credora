// src/screening/services/risk-scoring.service.ts
import { Injectable } from '@nestjs/common';
@Injectable()
export class RiskScoringService {
  calculateRiskScore(matches: any[]): number {
    if (matches.length === 0) return 0;

    let totalScore = 0;
    let weightedScore = 0;

    for (const match of matches) {
      const baseScore = match.score;
      const typeWeight = this.getTypeWeight(match.entry.type);
      const sourceWeight = this.getSourceWeight(match.entry.source);

      const adjustedScore = baseScore * typeWeight * sourceWeight;
      weightedScore += adjustedScore;
      totalScore += 100; // max possible score
    }

    return Math.min(100, (weightedScore / totalScore) * 100);
  }

  private getTypeWeight(type: string): number {
    const weights = {
      sanctions: 1.0,
      pep: 0.8,
      adverse_media: 0.6,
      custom: 0.7,
    };
    return weights[type] || 0.5;
  }

  private getSourceWeight(source: string): number {
    const weights = {
      ofac: 1.0,
      un: 0.9,
      eu: 0.9,
      custom: 0.6,
    };
    return weights[source] || 0.5;
  }

  determineRiskLevel(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  determineStatus(riskScore: number, matches: any[]): string {
    if (matches.length === 0) return 'clear';
    if (riskScore >= 80) return 'blocked';
    return 'potential_match';
  }
}
