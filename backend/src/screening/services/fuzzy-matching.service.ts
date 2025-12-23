// src/screening/services/fuzzy-matching.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class FuzzyMatchingService {
  calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance implementation
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return ((maxLength - distance) / maxLength) * 100;
  }

  normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findMatches(
    searchTerm: string,
    watchlistEntries: any[],
    threshold = 80,
  ): any[] {
    const normalizedSearch = this.normalizeString(searchTerm);
    const matches: { entry: any; score: number; matchedField: string }[] = [];
    for (const entry of watchlistEntries) {
      const normalizedEntry = this.normalizeString(entry.name);
      const score = this.calculateSimilarity(normalizedSearch, normalizedEntry);

      if (score >= threshold) {
        matches.push({
          entry,
          score,
          matchedField: 'name',
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}
