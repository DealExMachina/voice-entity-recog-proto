import rateLimit, { Options } from 'express-rate-limit';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { RateLimitConfig } from '../types/index.js';

interface RateLimitOptions extends Partial<Options> {
  windowMs?: number;
  max?: number;
  message?: {
    error: string;
    message: string;
    retryAfter: number;
  };
}

// Rate limiting configuration
const createRateLimiter = (options: RateLimitOptions = {}): RequestHandler => {
  const isRateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
  
  if (!isRateLimitEnabled) {
    // Return a no-op middleware if rate limiting is disabled
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15');
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  const windowMs = windowMinutes * 60 * 1000;

  const defaultOptions: RateLimitOptions = {
    windowMs,
    max: maxRequests,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Different rate limiters for different endpoints
export const generalLimiter: RequestHandler = createRateLimiter({
  max: 200, // More lenient for general endpoints
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const aiLimiter: RequestHandler = createRateLimiter({
  max: 50, // Stricter for AI endpoints (expensive)
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'AI API rate limit exceeded',
    message: 'Too many AI requests. Please wait before making more requests.',
    retryAfter: 900 // 15 minutes
  }
});

export const uploadLimiter: RequestHandler = createRateLimiter({
  max: 20, // Very strict for file uploads
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many file uploads. Please wait before uploading more files.',
    retryAfter: 900
  }
});

export const healthLimiter: RequestHandler = createRateLimiter({
  max: 1000, // Very lenient for health checks
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Export the rate limiter creator for custom use
export default createRateLimiter; 