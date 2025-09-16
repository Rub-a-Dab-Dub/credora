import { config } from 'dotenv';
config();

// Centralized configuration for document handling

export const ALLOWED_MIME_TYPES: string[] = (process.env.DOC_ALLOWED_MIME
  ? process.env.DOC_ALLOWED_MIME.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['application/pdf', 'image/jpeg', 'image/png']
).map((m) => m.toLowerCase());

export const MAX_FILE_SIZE_BYTES: number = Number.parseInt(
  process.env.DOC_MAX_SIZE_BYTES || `${10 * 1024 * 1024}`,
  10,
);

export const CLAMAV_HOST = process.env.CLAMAV_HOST || '127.0.0.1';
export const CLAMAV_PORT = Number.parseInt(process.env.CLAMAV_PORT || '3310', 10);

export const WEBHOOK_ALLOWED_DOMAINS: string[] = (process.env.WEBHOOK_ALLOWED_DOMAINS
  ? process.env.WEBHOOK_ALLOWED_DOMAINS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : []);

export const WEBHOOK_SECRET: string = process.env.WEBHOOK_SECRET || '';

export function isHostAllowed(hostname: string): boolean {
  if (WEBHOOK_ALLOWED_DOMAINS.length === 0) return false; // default deny
  const host = (hostname || '').toLowerCase();
  return WEBHOOK_ALLOWED_DOMAINS.some((allowed) => {
    if (host === allowed) return true;
    return host.endsWith(`.${allowed}`);
  });
}
