import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidService } from './plaid.service';
import { encrypt, decrypt } from './utils/encryption.util';

@Injectable()
export class BankingService {
  // In a real application, you would store this in a database (e.g., using TypeORM).
  // We map a user ID to their encrypted Plaid access token.
  private linkedAccounts = new Map<string, string>();
  private readonly encryptionKey: string;

  constructor(
    private readonly plaidService: PlaidService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new InternalServerErrorException('A 32-byte ENCRYPTION_KEY must be configured.');
    }
  }

  /**
   * Orchestrates the creation of a Plaid Link token for the frontend.
   * @param userId The ID of the user linking their account.
   */
  async generateLinkToken(userId: string) {
    // This calls the PlaidService to get a token from the Plaid API.
    return this.plaidService.createLinkToken(userId);
  }

  /**
   * Sets a linked account for a user by exchanging a public token for an access token
   * and storing the encrypted access token.
   * @param userId The ID of the user.
   * @param publicToken The temporary public token from the Plaid Link frontend flow.
   */
  async setLinkedAccount(userId: string, publicToken: string) {
    const tokenData = await this.plaidService.exchangePublicToken(publicToken);
    const accessToken = tokenData.access_token;

    // Encrypt the access token before storing it.
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey);

    // Store the encrypted token, linking it to our internal user ID.
    this.linkedAccounts.set(userId, encryptedAccessToken);
    console.log(`Account linked for user ${userId}.`);

    return { message: 'Bank account linked successfully.' };
  }

  /**
   * Retrieves transactions for a user's linked account.
   * @param userId The ID of the user.
   */
  async getUserTransactions(userId: string) {
    const encryptedAccessToken = this.linkedAccounts.get(userId);
    if (!encryptedAccessToken) {
      throw new UnauthorizedException('User does not have a linked bank account.');
    }

    // Decrypt the token just before using it.
    const accessToken = decrypt(encryptedAccessToken, this.encryptionKey);

    // Use the decrypted token to fetch transactions from Plaid.
    const transactionsData = await this.plaidService.getTransactions(accessToken);

    // Here, you could implement transaction categorization and analysis algorithms.
    console.log(`Fetched ${transactionsData.transactions.length} transactions for user ${userId}.`);

    return transactionsData;
  }
}
