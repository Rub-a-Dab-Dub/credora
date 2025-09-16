import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ApiEndpoint } from './entities/api-endpoint.entity';
import { createProxyMiddleware } from 'http-proxy-middleware';

export interface EndpointRegistrationDto {
  path: string;
  method: string;
  version: string;
  targetUrl: string;
  transformationRules?: Record<string, any>;
  rateLimitConfig?: Record<string, any>;
  circuitBreakerConfig?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface EndpointFilter {
  version?: string;
  isActive?: boolean;
  method?: string;
}

@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);
  private readonly proxyInstances = new Map<string, any>();

  constructor(
    @InjectRepository(ApiEndpoint)
    private readonly endpointRepository: Repository<ApiEndpoint>,
  ) {}

  async registerEndpoint(data: EndpointRegistrationDto): Promise<ApiEndpoint> {
    try {
      const endpoint = this.endpointRepository.create({
        path: this.normalizePath(data.path),
        method: data.method.toUpperCase(),
        version: data.version,
        targetUrl: data.targetUrl,
        transformationRules: data.transformationRules,
        rateLimitConfig: data.rateLimitConfig,
        circuitBreakerConfig: data.circuitBreakerConfig,
        headers: data.headers,
        timeout: data.timeout || 30000,
      });

      const saved = await this.endpointRepository.save(endpoint);
      this.logger.log(`Registered endpoint: ${data.method} ${data.path} -> ${data.targetUrl}`);
      
      return saved;
    } catch (error) {
      this.logger.error('Failed to register endpoint', error);
      throw new HttpException('Failed to register endpoint', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateEndpoint(id: string, updateData: Partial<EndpointRegistrationDto>): Promise<ApiEndpoint> {
    try {
      const endpoint = await this.endpointRepository.findOne({ where: { id } });
      
      if (!endpoint) {
        throw new HttpException('Endpoint not found', HttpStatus.NOT_FOUND);
      }

      if (updateData.path) {
        updateData.path = this.normalizePath(updateData.path);
      }

      if (updateData.method) {
        updateData.method = updateData.method.toUpperCase();
      }

      Object.assign(endpoint, updateData);
      const updated = await this.endpointRepository.save(endpoint);
      
      this.logger.log(`Updated endpoint ${id}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Failed to update endpoint', error);
      throw new HttpException('Failed to update endpoint', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteEndpoint(id: string): Promise<void> {
    try {
      const result = await this.endpointRepository.delete(id);
      
      if (result.affected === 0) {
        throw new HttpException('Endpoint not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Deleted endpoint ${id}`);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Failed to delete endpoint', error);
      throw new HttpException('Failed to delete endpoint', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEndpoints(filter: EndpointFilter = {}): Promise<ApiEndpoint[]> {
    try {
      const where: FindOptionsWhere<ApiEndpoint> = {};

      if (filter.version) {
        where.version = filter.version;
      }

      if (filter.isActive !== undefined) {
        where.isActive = filter.isActive;
      }

      if (filter.method) {
        where.method = filter.method.toUpperCase();
      }

      return this.endpointRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error('Failed to get endpoints', error);
      throw new HttpException('Failed to get endpoints', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getEndpoint(path: string, method: string, version: string): Promise<ApiEndpoint | null> {
    try {
      return this.endpointRepository.findOne({
        where: {
          path: this.normalizePath(path),
          method: method.toUpperCase(),
          version,
          isActive: true,
        },
      });
    } catch (error) {
      this.logger.error('Failed to get endpoint', error);
      return null;
    }
  }

  async proxyRequest(targetUrl: string, req: any, res: any): Promise<void> {
    try {
      const proxyKey = this.getProxyKey(targetUrl);
      let proxy = this.proxyInstances.get(proxyKey);

      if (!proxy) {
        proxy = this.createProxyInstance(targetUrl);
        this.proxyInstances.set(proxyKey, proxy);
      }

      return new Promise((resolve, reject) => {
        proxy(req, res, (error: any) => {
          if (error) {
            this.logger.error('Proxy error', error);
            reject(new HttpException('Proxy request failed', HttpStatus.BAD_GATEWAY));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to proxy request', error);
      throw new HttpException('Proxy request failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async generateOpenApiSpec(): Promise<any> {
    try {
      const endpoints = await this.getEndpoints({ isActive: true });
      
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Credora API Gateway',
          version: '1.0.0',
          description: 'Comprehensive API Gateway with rate limiting and analytics',
        },
        servers: [
          {
            url: process.env.API_GATEWAY_URL || 'http://localhost:3000',
            description: 'API Gateway Server',
          },
        ],
        paths: {},
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      };

      const pathGroups = new Map<string, Map<string, ApiEndpoint>>();
      
      endpoints.forEach(endpoint => {
        if (!pathGroups.has(endpoint.path)) {
          pathGroups.set(endpoint.path, new Map());
        }
        pathGroups.get(endpoint.path)!.set(endpoint.method.toLowerCase(), endpoint);
      });

      for (const [path, methods] of pathGroups) {
        spec.paths[path] = {};
        
        for (const [method, endpoint] of methods) {
          spec.paths[path][method] = {
            summary: `${method.toUpperCase()} ${path}`,
            description: `Proxy endpoint for ${endpoint.targetUrl}`,
            parameters: this.generateParameters(path),
            responses: {
              200: {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                    },
                  },
                },
              },
              400: {
                description: 'Bad request',
              },
              401: {
                description: 'Unauthorized',
              },
              429: {
                description: 'Too many requests',
              },
              500: {
                description: 'Internal server error',
              },
            },
            security: [
              { ApiKeyAuth: [] },
              { BearerAuth: [] },
            ],
            tags: [endpoint.version],
          };

          if (['post', 'put', 'patch'].includes(method)) {
            spec.paths[path][method].requestBody = {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            };
          }
        }
      }

      return spec;
    } catch (error) {
      this.logger.error('Failed to generate OpenAPI spec', error);
      throw new HttpException('Failed to generate OpenAPI spec', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    return path;
  }

  private getProxyKey(targetUrl: string): string {
    const url = new URL(targetUrl);
    return `${url.protocol}//${url.host}`;
  }

private createProxyInstance(targetUrl: string): any {
  const url = new URL(targetUrl);
  const target = `${url.protocol}//${url.host}`;

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      '^/api-gateway/proxy': '',
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Forwarded-By', 'Credora-API-Gateway');
      },
      proxyRes: (proxyRes, req, res) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
      },
      error: (err, req, res: any) => {
        this.logger.error('Proxy middleware error', err);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: 'Failed to proxy request',
          });
        }
      },
    },
  });
}


private generateParameters(path: string): any[] {
  const parameters: any[] = [];
  
  const pathParams = path.match(/:\w+/g);
  if (pathParams) {
    pathParams.forEach(param => {
      const paramName = param.substring(1); 
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: {
          type: 'string',
        },
      });
    });
  }

  parameters.push(
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      description: 'Number of items to return',
    },
    {
      name: 'offset',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        minimum: 0,
        default: 0,
      },
      description: 'Number of items to skip',
    },
  );

  return parameters;
  } 
}