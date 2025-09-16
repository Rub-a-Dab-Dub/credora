// src/redis/redis.module.ts
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
        });
      },
    },
    RedisService, // now depends on REDIS_CLIENT
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}
