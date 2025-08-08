import { IsObject } from 'class-validator';

export class PreferencesDto {
  @IsObject()
  preferences: Record<string, any>;
}
