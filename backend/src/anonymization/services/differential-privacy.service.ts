// A service for implementing differential privacy using the Laplace mechanism.

@Injectable()
export class DifferentialPrivacyService {
  /**
   * Generate Laplace-distributed noise using inverse transform sampling.
   *
   * @param mu The mean of the distribution (usually 0 for DP).
   * @param b The scale parameter (sensitivity / epsilon).
   * @returns A Laplace-distributed random value.
   */
  private laplace(mu: number, b: number): number {
    const u = Math.random() - 0.5; // uniform(-0.5, 0.5)
    return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Adds Laplace noise to a numerical value to ensure differential privacy.
   *
   * @param value The original numerical value.
   * @param epsilon The privacy budget. A smaller epsilon means more privacy but less utility.
   * @param sensitivity The L1 sensitivity of the query function.
   * @returns The differentially private value.
   */
  addNoise(value: number, epsilon: number, sensitivity: number): number {
    const scale = sensitivity / epsilon;
    const noise = this.laplace(0, scale);
    return value + noise;
  }
}

// --- src/anonymization/services/pseudonymization.service.ts (UPDATED) ---
// An updated version of the pseudonymization service with state for reversibility.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PseudonymizationService implements OnModuleInit {
  private pseudonymMap = new Map<string, string>();
  private readonly mapFilePath = path.join(__dirname, 'pseudonym-map.json');

  onModuleInit() {
    this.loadMap();
  }

  /**
   * Pseudonymizes a piece of data, replacing it with a consistent, unique identifier.
   * The mapping is saved for future lookups.
   * @param data The input data to pseudonymize.
   * @returns The pseudonymized string.
   */
  pseudonymize(data: string): string {
    if (this.pseudonymMap.has(data)) {
      return this.pseudonymMap.get(data)!;
    }

    // Use a secure, persistent salt in a real-world scenario.
    const salt = 'your-secure-and-secret-salt'; 
    const pseudonym = createHash('sha256')
      .update(data + salt)
      .digest('hex');
    
    this.pseudonymMap.set(data, pseudonym);
    this.saveMap(); // Persist the new mapping.
    return pseudonym;
  }

  /**
   * Reverses the pseudonymization process to retrieve the original data.
   * @param pseudonym The pseudonym to reverse.
   * @returns The original data, or null if not found.
   */
  reversePseudonym(pseudonym: string): string | null {
    for (const [key, value] of this.pseudonymMap.entries()) {
      if (value === pseudonym) {
        return key;
      }
    }
    return null;
  }

  /**
   * Saves the pseudonym map to a file.
   * In a production environment, this would be a database call.
   */
  private saveMap() {
    try {
      const mapAsObject = Object.fromEntries(this.pseudonymMap);
      fs.writeFileSync(this.mapFilePath, JSON.stringify(mapAsObject, null, 2));
    } catch (error) {
      console.error('Failed to save pseudonym map:', error);
    }
  }

  /**
   * Loads the pseudonym map from a file.
   * In a production environment, this would be a database call.
   */
  private loadMap() {
    try {
      if (fs.existsSync(this.mapFilePath)) {
        const fileContent = fs.readFileSync(this.mapFilePath, 'utf8');
        const mapAsObject = JSON.parse(fileContent);
        this.pseudonymMap = new Map(Object.entries(mapAsObject));
      }
    } catch (error) {
      console.error('Failed to load pseudonym map:', error);
    }
  }
}
