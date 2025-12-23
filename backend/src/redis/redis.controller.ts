// src/redis/redis.controller.ts
import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @Post('set')
  async set(
    @Body('key') key: string,
    @Body('value') value: string,
    @Body('ttl') ttl?: number,
  ) {
    await this.redisService.set(key, value, ttl);
    return { message: 'Key set successfully' };
  }

  @Get('get/:key')
  async get(@Param('key') key: string) {
    const value = await this.redisService.get(key);
    return { key, value };
  }

  @Delete('del/:key')
  async del(@Param('key') key: string) {
    await this.redisService.del(key);
    return { message: 'Key deleted successfully' };
  }

  @Get('exists/:key')
  async exists(@Param('key') key: string) {
    const exists = await this.redisService.exists(key);
    return { key, exists };
  }
}
