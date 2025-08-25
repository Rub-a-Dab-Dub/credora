// src/users/users.controller.ts
import { Body, Controller, Get, Post, Put, Delete, Param, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PreferencesDto } from './dto/preferences.dto';
import { DeactivateProfileDto } from './dto/deactivate-profile.dto';

@Controller('users')
@UseInterceptors(CacheInterceptor) // Apply the interceptor to the whole controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createProfile(@Body() dto: CreateProfileDto) {
    return this.usersService.createProfile(dto);
  }

  @Get(':id')
  @CacheKey('user_profile_response') // Custom cache key for this endpoint
  @CacheTTL(300) // Cache response for 5 minutes (300 seconds)
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  @Put(':id')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(id, dto);
  }

  @Delete(':id')
  deleteProfile(@Param('id') id: string) {
    return this.usersService.deleteProfile(id);
  }

  @Put(':id/preferences')
  setPreferences(@Param('id') id: string, @Body() dto: PreferencesDto) {
    return this.usersService.setPreferences(id, dto);
  }

  @Get(':id/export')
  @CacheKey('user_export_response') // A different cache key for the export endpoint
  @CacheTTL(300) // Cache response for 5 minutes
  exportProfile(@Param('id') id: string) {
    return this.usersService.exportProfile(id);
  }

  @Put(':id/deactivate')
  deactivateProfile(@Param('id') id: string, @Body() dto: DeactivateProfileDto) {
    return this.usersService.deactivateProfile(id, dto);
  }
}
