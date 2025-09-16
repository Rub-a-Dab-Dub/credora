import { Body, Controller, Get, Post, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { BankingService } from './banking.service';
import { LinkAccountDto } from './dto/link-account.dto';

@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  /**
   * Endpoint for the frontend to get a link_token to initialize Plaid Link.
   * In a real app, the userId would come from an authenticated session.
   */
  @Post('create-link-token/:userId')
  createLinkToken(@Param('userId') userId: string) {
    return this.bankingService.generateLinkToken(userId);
  }

  /**
   * Endpoint to link a bank account. The frontend sends the public_token
   * it receives from a successful Plaid Link flow.
   */
  @Post('link-account')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  linkAccount(@Body() linkAccountDto: LinkAccountDto) {
    return this.bankingService.setLinkedAccount(
      linkAccountDto.userId,
      linkAccountDto.public_token,
    );
  }

  /**
   * Endpoint to fetch transactions for a specific user.
   */
  @Get('transactions/:userId')
  getTransactions(@Param('userId') userId: string) {
    return this.bankingService.getUserTransactions(userId);
  }

  /**
   * Webhook endpoint for Plaid to send real-time transaction updates.
   * This endpoint needs to be publicly accessible.
   */
  @Post('plaid/webhook')
  handlePlaidWebhook(@Body() webhookData: any) {
    console.log('Received Plaid Webhook:', webhookData);
    // TODO: Add logic to handle webhook events, e.g., new transactions, item errors.
    // This requires implementing webhook verification for security.
    return { status: 'received' };
  }
}
