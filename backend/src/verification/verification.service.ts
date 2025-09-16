import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { VerificationRequestDto } from './dto/verification-request.dto';
import { VerificationResponseDto } from './dto/verification-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class VerificationService {
  private jumioApiKey = process.env.JUMIO_API_KEY;
  private onfidoApiKey = process.env.ONFIDO_API_KEY;

  // Initiate verification with Jumio using the VerificationRequestDto
  async verifyWithJumio(verificationData: VerificationRequestDto): Promise<VerificationResponseDto> {
    const response = await axios.post(
      'https://api.jumio.com/verify',
      verificationData,
      {
        headers: {
          Authorization: `Bearer ${this.jumioApiKey}`,
        },
      },
    );
    return response.data; // Return data in the shape of VerificationResponseDto
  }

  // Initiate verification with Onfido using the VerificationRequestDto
  async verifyWithOnfido(verificationData: VerificationRequestDto): Promise<VerificationResponseDto> {
    const response = await axios.post(
      'https://api.onfido.com/v3.6/checks',
      verificationData,
      {
        headers: {
          Authorization: `Bearer ${this.onfidoApiKey}`,
        },
      },
    );
    return response.data; // Return data in the shape of VerificationResponseDto
  }

  // Multi-provider fallback logic
  async performVerification(verificationData: VerificationRequestDto): Promise<VerificationResponseDto| undefined> {
    try {
      const jumioResult = await this.verifyWithJumio(verificationData);
      if (jumioResult.verificationStatus === 'verified') {
        return jumioResult;
      }
    } catch (error) {
      console.error('Jumio failed, falling back to Onfido');
      return this.verifyWithOnfido(verificationData);
    }

    try {
      const onfidoResult = await this.verifyWithOnfido(verificationData);
      if (onfidoResult.verificationStatus === 'verified') {
        return onfidoResult;
      }
    } catch (error) {
      console.error('Both providers failed');
      return 
    }
  return
  }
}

