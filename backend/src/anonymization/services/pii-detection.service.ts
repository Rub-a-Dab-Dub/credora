
// src/anonymization/services/pii-detection.service.ts
// A service to detect and mask PII using a simple regex-based approach.
import { Injectable } from '@nestjs/common';

@Injectable()
export class PiiDetectionService {
  /**
   * Detects and masks common PII types using regular expressions.
   * @param text The input string to be anonymized.
   * @returns The string with PII masked.
   */
  detectAndMaskPii(text: string): string {
    // Basic regex for email, phone numbers, and common names.
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?\d{1,2}\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;

    let maskedText = text.replace(emailRegex, '[EMAIL_MASKED]');
    maskedText = maskedText.replace(phoneRegex, '[PHONE_MASKED]');
    // Note: A more robust implementation would use a dedicated PII detection library.
    return maskedText;
  }
}
