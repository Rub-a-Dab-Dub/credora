import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidApi, Configuration, PlaidEnvironments, CountryCode, Products } from 'plaid';

@Injectable()
export class PlaidService {
  private readonly plaidClient: PlaidApi;

  constructor(private configService: ConfigService) {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[this.configService.get<string>('PLAID_ENV')],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.configService.get<string>('PLAID_CLIENT_ID'),
          'PLAID-SECRET': this.configService.get<string>('PLAID_SECRET_SANDBOX'),
        },
      },
    });

    this.plaidClient = new PlaidApi(configuration);
  }

  /**
   * Creates a link_token required to initialize the Plaid Link flow on the frontend.
   * This token authenticates our app with Plaid and customizes the Link experience.
   * @param userId The ID of the user initiating the connection.
   */
  async createLinkToken(userId: string) {
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: 'My Banking App',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: 'https://your-api-url.com/banking/plaid/webhook', // A public URL for Plaid to send updates
    };

    const response = await this.plaidClient.linkTokenCreate(request);
    return response.data;
  }

  /**
   * Exchanges a temporary public_token (from the frontend) for a permanent access_token.
   * This access_token is what we use to make API calls on behalf of the user.
   * @param publicToken The temporary token from Plaid Link.
   */
  async exchangePublicToken(publicToken: string) {
    const response = await this.plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    return response.data; // Contains access_token and item_id
  }

  /**
   * Fetches transaction data for a linked bank account.
   * @param accessToken The permanent token for the user's item.
   */
  async getTransactions(accessToken: string) {
    const response = await this.plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: '2024-01-01', // Example start date
      end_date: '2024-12-31',   // Example end date
    });
    return response.data;
  }
}
