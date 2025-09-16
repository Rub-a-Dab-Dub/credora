import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { PlaidService } from './plaid.service';

@Module({
  imports: [ConfigModule], // Make ConfigService available within this module
  controllers: [BankingController],
  providers: [BankingService, PlaidService],
})
export class BankingModule {}
