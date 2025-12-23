// src/screening/processors/screening.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ScreeningService } from '../services/screening.service';
@Processor('screening-queue')
export class ScreeningProcessor {
  constructor(private screeningService: ScreeningService) {}

  @Process('screen-entity')
  async handleScreening(job: Job) {
    const { entityId, entityType, screeningData } = job.data;

    try {
      const result = await this.screeningService.performScreening(
        entityId,
        entityType,
        screeningData,
      );

      console.log(
        `Screening completed for entity ${entityId}: ${result.status}`,
      );
      return result;
    } catch (error) {
      console.error(`Screening failed for entity ${entityId}:`, error);
      throw error;
    }
  }
}
