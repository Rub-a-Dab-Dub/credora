import { Controller, Post, Body, Headers } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationRequestDto } from './dto/verification-request.dto';
import { VerificationResponseDto } from './dto/verification-response.dto';


@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('webhook/jumio')
  handleJumioWebhook(@Body() payload: any, @Headers() headers: any) {
    // Process Jumio webhook
    console.log('Jumio verification result received:', payload);
    // Store or update metadata as needed
  }

  @Post('webhook/onfido')
  handleOnfidoWebhook(@Body() payload: any, @Headers() headers: any) {
    // Process Onfido webhook
    console.log('Onfido verification result received:', payload);
    // Store or update metadata as needed
  }

  // Handle the request to perform identity verification
  @Post('perform-verification')
  async performVerification(
    @Body() verificationData: VerificationRequestDto
  ): Promise<VerificationResponseDto | undefined> {
    return this.verificationService.performVerification(verificationData);
  }
}
