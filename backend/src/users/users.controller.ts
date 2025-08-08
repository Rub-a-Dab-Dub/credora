// src/users/users.controller.ts
import { Body, Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PreferencesDto } from './dto/preferences.dto';
import { DeactivateProfileDto } from './dto/deactivate-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createProfile(@Body() dto: CreateProfileDto) {
    return this.usersService.createProfile(dto);
  }

  @Get(':id')
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
  exportProfile(@Param('id') id: string) {
    return this.usersService.exportProfile(id);
  }

  @Put(':id/deactivate')
  deactivateProfile(@Param('id') id: string, @Body() dto: DeactivateProfileDto) {
    return this.usersService.deactivateProfile(id, dto);
  }
}
