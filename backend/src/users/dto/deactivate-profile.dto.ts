import { IsBoolean } from 'class-validator';

export class DeactivateProfileDto {
  @IsBoolean()
  deactivate: boolean;
}
