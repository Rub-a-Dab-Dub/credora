// src/screening/controllers/screening.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ScreeningService } from '../services/screening.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; //
@Controller('screening')
@UseGuards(JwtAuthGuard) // Assuming you have auth guards
export class ScreeningController {
  constructor(private screeningService: ScreeningService) {}

  @Post('screen')
  async screenEntity(@Body() screenEntityDto: any) {
    const jobId = await this.screeningService.screenEntity(
      screenEntityDto.entityId,
      screenEntityDto.entityType,
      screenEntityDto.screeningData,
    );

    return { jobId, message: 'Screening job queued successfully' };
  }

  @Get('result/:id')
  async getScreeningResult(@Param('id') id: string) {
    return this.screeningService.getScreeningResult(id);
  }

  @Post('false-positive/:id')
  async markAsFalsePositive(
    @Param('id') id: string,
    @Body() body: { reviewedBy: string; notes: string },
  ) {
    return this.screeningService.markAsFalsePositive(
      id,
      body.reviewedBy,
      body.notes,
    );
  }

  @Get('history/:entityId')
  async getScreeningHistory(@Param('entityId') entityId: string) {
    return this.screeningService.getScreeningHistory(entityId);
  }
}
