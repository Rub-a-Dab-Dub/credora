import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Encrypts a piece of text.
 * @param text The text to encrypt.
 * @param secretKey A 32-byte secret key.
 * @returns The encrypted string.
 */
export function encrypt(text: string, secretKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(secretKey, salt, 32) as Buffer;

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString(ENCODING);
}

/**
 * Decrypts a piece of text.
 * @param encryptedText The encrypted string.
 * @param secretKey The 32-byte secret key used to encrypt.
 * @returns The original decrypted text.
 */
export function decrypt(encryptedText: string, secretKey: string): string {
  const data = Buffer.from(encryptedText, ENCODING);
  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = scryptSync(secretKey, salt, 32) as Buffer;
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
