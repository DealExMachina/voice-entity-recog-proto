import { Request, Response, NextFunction } from 'express';

// Custom error class with user-friendly messages
export class AppError extends Error {
  public readonly type: string;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly timestamp: string;

  constructor(message: string, type: string = 'general', statusCode: number = 500, userMessage?: string) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, AppError);
    }
  }

  private getDefaultUserMessage(type: string): string {
    const messages: Record<string, string> = {
      'timeout': 'The operation took too long to complete. Please try again.',
      'network': 'Unable to connect to the service. Please check your internet connection.',
      'validation': 'The provided information is invalid. Please check your input.',
      'ratelimit': 'Too many requests. Please wait a moment before trying again.',
      'upload': 'There was a problem with your file upload. Please try again.',
      'ai_provider': 'The AI service is temporarily unavailable. Please try again later.',
      'database': 'There was a problem saving your data. Please try again.',
      'transcription': 'Unable to process the audio. Please ensure the file is a valid audio format.',
      'permission': 'You don\'t have permission to perform this action.',
      'not_found': 'The requested resource was not found.',
      'general': 'An unexpected error occurred. Please try again.'
    };
    return messages[type] || messages['general'];
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  timestamp?: string;
  details?: string;
  stack?: string;
  retryAfter?: number;
}

export class ErrorHandler {
  static handleApiError(error: Error | AppError, req: Request, res: Response, next: NextFunction): void {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Handle custom AppError
    if (error instanceof AppError) {
      const response: ErrorResponse = {
        success: false,
        error: error.type,
        message: error.userMessage,
        timestamp: error.timestamp
      };

      if (process.env.NODE_ENV === 'development') {
        response.details = error.message;
        response.stack = error.stack;
      }

      res.status(error.statusCode).json(response);
      return;
    }

    // Handle specific Node.js error types
    if ('name' in error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'validation',
        message: 'Please check your input and try again.',
        details: error.message
      });
      return;
    }

    // Handle network errors
    if ('code' in error && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
      res.status(503).json({
        success: false,
        error: 'network',
        message: 'Service temporarily unavailable. Please try again later.'
      });
      return;
    }

    // Handle timeout errors
    if ('name' in error && error.name === 'TimeoutError' || 
        'code' in error && error.code === 'ETIMEDOUT') {
      res.status(408).json({
        success: false,
        error: 'timeout',
        message: 'The operation took too long to complete. Please try again.'
      });
      return;
    }

    // Handle rate limiting
    if ('status' in error && error.status === 429) {
      const retryAfter = 'retryAfter' in error ? error.retryAfter as number : 900;
      res.status(429).json({
        success: false,
        error: 'ratelimit',
        message: 'Too many requests. Please wait before trying again.',
        retryAfter
      });
      return;
    }

    // Default error response
    const response: ErrorResponse = {
      success: false,
      error: 'general',
      message: 'An unexpected error occurred. Please try again.',
      timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development') {
      response.details = error.message;
    }

    res.status(500).json(response);
  }

  static wrapAsync<T extends Request, U extends Response>(
    fn: (req: T, res: U, next: NextFunction) => Promise<void>
  ) {
    return (req: T, res: U, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static createTimeoutWrapper<T extends any[], R>(timeoutMs: number = 30000) {
    return (fn: (...args: T) => Promise<R>) => {
      return async (...args: T): Promise<R> => {
        return Promise.race([
          fn(...args),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new AppError('Operation timed out', 'timeout', 408));
            }, timeoutMs);
          })
        ]);
      };
    };
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain types of errors
        if (error instanceof AppError && 
            ['validation', 'permission', 'not_found'].includes(error.type)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`Operation failed, attempt ${attempt}/${maxRetries}:`, error instanceof Error ? error.message : String(error));
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError!;
  }
}

// Timeout constants
export const timeouts = {
  AI_REQUEST: 45000,      // 45 seconds for AI operations
  DATABASE: 10000,        // 10 seconds for database operations
  FILE_UPLOAD: 60000,     // 60 seconds for file uploads
  TRANSCRIPTION: 120000,  // 2 minutes for transcription
  GENERAL_API: 30000,     // 30 seconds for general API calls
  WEBSOCKET: 30000        // 30 seconds for WebSocket operations
} as const;

// Utility function to create timeout promise
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorType: string = 'timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError(`Operation timed out after ${timeoutMs}ms`, errorType, 408));
      }, timeoutMs);
    })
  ]);
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError('Service temporarily unavailable', 'network', 503);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// Health check utility
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, 'connected' | 'active' | 'ready' | 'unavailable' | 'error'>;
  uptime: number;
  version: string;
}

export function createHealthResponse(
  services: Record<string, 'connected' | 'active' | 'ready' | 'unavailable' | 'error'>,
  version: string = '1.0.0'
): HealthStatus {
  const healthyStates = ['connected', 'active', 'ready'];
  const serviceValues = Object.values(services);
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  
  if (serviceValues.every(state => healthyStates.includes(state))) {
    status = 'healthy';
  } else if (serviceValues.some(state => healthyStates.includes(state))) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    services,
    uptime: process.uptime(),
    version
  };
}