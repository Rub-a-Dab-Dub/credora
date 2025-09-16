import { Module } from '@nestjs/common';
import { AnonymizationController } from './controllers/anonymization.controller';
import { PiiDetectionService } from './services/pii-detection.service';
import { PseudonymizationService } from './services/pseudonymization.service';

@Module({
  imports: [],
  controllers: [AnonymizationController],
  providers: [PiiDetectionService, PseudonymizationService],
})
export class AnonymizationModule {}

