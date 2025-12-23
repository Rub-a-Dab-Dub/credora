// A service to replace PII with a unique, reversible pseudonym.
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class PseudonymizationService {
  private pseudonymMap = new Map<string, string>();
  // In a real-world scenario, this would be a secure, persistent store (e.g., a database).

  /**
   * Pseudonymizes a piece of data, replacing it with a consistent, unique identifier.
   * @param data The input data to pseudonymize.
   * @returns The pseudonymized string.
   */
  pseudonymize(data: string): string {
    if (this.pseudonymMap.has(data)) {
      return this.pseudonymMap.get(data)!;
    }

    const salt = 'your-secure-and-secret-salt'; // A strong, unique salt is critical.
    const pseudonym = createHash('sha256')
      .update(data + salt)
      .digest('hex');
    this.pseudonymMap.set(data, pseudonym);
    return pseudonym;
  }

  /**
   * Reverses the pseudonymization process to retrieve the original data.
   * This is a simple example; a production system would be more complex.
   * @param pseudonym The pseudonym to reverse.
   * @returns The original data, or null if not found.
   */
  reversePseudonym(pseudonym: string): string | null {
    // Find the original data by value in the map
    for (const [key, value] of this.pseudonymMap.entries()) {
      if (value === pseudonym) {
        return key;
      }
    }
    return null;
  }
}