import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consent } from './entities/consent.entity';
import { AuditLog } from './entities/audit-log.entity';
import { DataClassification } from './entities/data-classification.entity';
import { PrivacyAssessment } from './entities/privacy-assessment.entity';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [TypeOrmModule.forFeature([
    Consent, 
    AuditLog, 
    DataClassification, 
    PrivacyAssessment,
  ]),
    UsersModule,
    DocumentsModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
