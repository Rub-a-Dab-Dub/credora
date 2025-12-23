import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Import axios using require syntax to avoid TypeScript issues

import { ExperianAdapter } from './experian.adapter';
import { EquifaxAdapter } from './equifax.adapter';
import { TransUnionAdapter } from './transunion.adapter';
import { CreditBureauAdapter, NormalizedCreditReport } from './credit-bureau.adapter';
import * as CircuitBreaker from 'opossum';

/**
 * Types of credit bureaus supported by the system
 */
export type CreditBureauType = 'experian' | 'equifax' | 'transunion';

// Import axios normally
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CreditBureauService {
  private readonly logger = new Logger(CreditBureauService.name);
  private readonly adapters: Record<CreditBureauType, CreditBureauAdapter>;
  private readonly circuitBreakers: Record<CreditBureauType, CircuitBreaker>;

  constructor(private configService: ConfigService) {
    // Instead of trying to clone handlers, we just reapply them
    const baseAxios = this.createBaseAxiosInstance();

    this.adapters = {
      experian: new ExperianAdapter(
        this.createBureauSpecificAxios(baseAxios, 'experian'),
      ),
      equifax: new EquifaxAdapter(
        this.createBureauSpecificAxios(baseAxios, 'equifax'),
      ),
      transunion: new TransUnionAdapter(
        this.createBureauSpecificAxios(baseAxios, 'transunion'),
      ),
    };

    this.circuitBreakers = {
      experian: this.createCircuitBreaker('experian'),
      equifax: this.createCircuitBreaker('equifax'),
      transunion: this.createCircuitBreaker('transunion'),
    };
  }

  /**
   * Base axios instance with generic interceptors
   */
   private createBaseAxiosInstance(): AxiosInstance {
    const instance = axios.create({});

    instance.interceptors.request.use((config) => {
      if (config.headers?.set) {
        config.headers.set('User-Agent', 'Credora/1.0');
        config.headers.set('Content-Type', 'application/json');
      } else {
        // fallback if headers is a plain object
        (config.headers as any) = {
          ...config.headers,
          'User-Agent': 'Credora/1.0',
          'Content-Type': 'application/json',
        };
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 1;
          await new Promise((res) => setTimeout(res, retryAfter * 1000));
          return instance(error.config);
        }
        return Promise.reject(error);
      },
    );

    return instance;
  }

  /**
   * Bureau-specific axios with base interceptors reapplied
   */
  private createBureauSpecificAxios(
    baseAxios: AxiosInstance,
    bureau: CreditBureauType,
  ): AxiosInstance {
    const instance = axios.create({});

    // Reapply the base interceptor logic
    instance.interceptors.request.use((config) => {
      if (config.headers?.set) {
        config.headers.set('User-Agent', 'Credora/1.0');
        config.headers.set('Content-Type', 'application/json');
      } else {
        (config.headers as any) = {
          ...config.headers,
          'User-Agent': 'Credora/1.0',
          'Content-Type': 'application/json',
        };
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 1;
          await new Promise((res) => setTimeout(res, retryAfter * 1000));
          return instance(error.config);
        }
        return Promise.reject(error);
      },
    );

    // Add bureau-specific config
    instance.interceptors.request.use((config) => {
      const apiKey = this.configService.get<string>(`creditBureau.${bureau}.apiKey`);
      const isSandbox = this.configService.get<boolean>(
        `creditBureau.${bureau}.sandbox`,
        true,
      );

      config.baseURL = isSandbox
        ? this.configService.get<string>(`creditBureau.${bureau}.sandboxUrl`)
        : this.configService.get<string>(`creditBureau.${bureau}.productionUrl`);

      if (config.headers?.set) {
        config.headers.set('Authorization', `Bearer ${apiKey}`);
      } else {
        (config.headers as any) = {
          ...config.headers,
          Authorization: `Bearer ${apiKey}`,
        };
      }

      return config;
    });

    return instance;
  }
  
  /**
   * Creates a circuit breaker for a specific bureau
   */
  private createCircuitBreaker(bureau: CreditBureauType): CircuitBreaker {
    const options = {
      timeout: 10000, // Time in ms before request is considered failed
      errorThresholdPercentage: 50, // Error % threshold to trip circuit
      resetTimeout: 30000, // Time in ms to wait before trying again
    };
    
    return new CircuitBreaker(
      async (userId: string, extra?: any) => {
        return this.adapters[bureau].getCreditReport(userId, extra);
      },
      options
    );
  }

  /**
   * Gets a credit report from the specified bureau
   */
  async getCreditReport(
    bureau: CreditBureauType, 
    userId: string, 
    extra?: any
  ): Promise<NormalizedCreditReport> {
    try {
      // Use circuit breaker to call adapter
      const report = await this.circuitBreakers[bureau].fire(userId, extra);
      return report;
    } catch (error) {
      // Handle circuit breaker or adapter errors
      if (error.type === 'open') {
        throw new Error(`${bureau} API is currently unavailable. Please try again later.`);
      }
      throw error;
    }
  }
  
  /**
   * Gets credit reports from all available bureaus
   */
  async getAllCreditReports(userId: string): Promise<Record<CreditBureauType, NormalizedCreditReport>> {
    const reports: Partial<Record<CreditBureauType, NormalizedCreditReport>> = {};
    
    // Make concurrent requests to all bureaus
    const promises = Object.keys(this.adapters).map(async (bureau) => {
      try {
        reports[bureau as CreditBureauType] = await this.getCreditReport(
          bureau as CreditBureauType,
          userId
        );
      } catch (error) {
        // Failures from one bureau shouldn't prevent others from returning
        this.logger.error(`Failed to get ${bureau} credit report:`, error.stack);
      }
    });
    
    await Promise.all(promises);
    return reports as Record<CreditBureauType, NormalizedCreditReport>;
  }
  
  /**
   * Handles a webhook from a credit bureau
   */
  async handleWebhook(bureau: CreditBureauType, payload: any): Promise<void> {
    return this.adapters[bureau].handleWebhook(payload);
  }
}
