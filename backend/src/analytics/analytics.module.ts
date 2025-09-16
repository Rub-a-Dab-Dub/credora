import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { InfluxdbModule } from '../influxdb/influxdb.module';

@Module({
  imports: [
    // Import the InfluxdbModule to make the database client available.
    InfluxdbModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // We export the service so other parts of the app can use it to track events.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

