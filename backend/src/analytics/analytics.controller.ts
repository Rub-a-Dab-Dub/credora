import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kyc-funnel')
  async getKycFunnel() {
    return this.analyticsService.getKycFunnelAnalysis();
  }

  @Get('credit-score-distribution')
  async getCreditScoreDistribution() {
    return this.analyticsService.getCreditScoreDistribution();
  }
}

