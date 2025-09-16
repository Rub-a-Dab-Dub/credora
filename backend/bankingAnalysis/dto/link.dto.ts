import { IsNotEmpty, IsString } from 'class-validator';

export class LinkAccountDto {
  @IsString()
  @IsNotEmpty()
  public_token: string;

  // You would typically get the userId from an authenticated session (e.g., a JWT guard)
  // For this example, we'll pass it in the body for simplicity.
  @IsString()
  @IsNotEmpty()
  userId: string;
}
