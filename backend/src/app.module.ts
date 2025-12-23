import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { EmailModule } from './email/email.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { IpfsModule } from './ipfs/ipfs.module';
import { CreditBureauModule } from './credit-bureaus/credit-bureau.module';
import { DocumentsModule } from './documents/documents.module';
import { BullModule } from '@nestjs/bull';
import { RiskModule } from './risk/risk.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { ScreeningModule } from './screening/screening.module';
import { ApiGatewayModule } from './api-gateway/api-gateway.module';
@Module({
  imports: [
    // 1. Load the .env file
    ConfigModule.forRoot({
      isGlobal: true, // Makes the .env variables available everywhere
      envFilePath: '.env',
    }),

    // 2. Setup the TypeORM connection
    TypeOrmModule.forRootAsync({
      imports: [UsersModule, ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: ['src/**/*.entity.ts', 'dist/**/*.entity.js'],
        synchronize: false, // Use migrations instead
        logging: true,
        extra: {
          max: configService.get<number>('DB_POOL_MAX', 20), // Default to 20 if not set
        },
      }),
    }),
    // 3. Register Bull queue for document processing
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    UsersModule,
    AuthModule,
    RedisModule,
    EmailModule,
    PrivacyModule,
    DocumentsModule,
    IpfsModule,
    // Credit Bureau Integration
    CreditBureauModule,
    RiskModule,
    AuditModule,
    ScreeningModule,
    ApiGatewayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
