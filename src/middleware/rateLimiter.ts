import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Extend Request interface for multer file upload
interface MulterRequest extends Request {
  file?: { originalname?: string; size?: number };
}

// Rate limiting configuration interface
interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: {
    error: string;
    message: string;
    retryAfter: number;
  };
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
  trustProxy?: boolean;
  handler?: (req: Request, res: Response) => void;
}

// Create rate limiter with proper TypeScript types
const createRateLimiter = (options: RateLimitConfig = {}) => {
  const isRateLimitEnabled = process.env.RATE_LIMIT_ENABLED === 'true';
  
  if (!isRateLimitEnabled) {
    // Return a no-op middleware if rate limiting is disabled
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15');
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

  const defaultOptions: RateLimitConfig = {
    windowMs: windowMinutes * 60 * 1000, // Convert to milliseconds
    max: maxRequests,
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(windowMinutes * 60)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Fix trust proxy issue by using a custom key generator
    keyGenerator: (req: Request): string => {
      // Use X-Forwarded-For in production, req.ip locally
      return req.headers['x-forwarded-for']?.toString().split(',')[0] || 
             req.ip || 
             req.socket.remoteAddress || 
             'unknown';
    },
    // Skip trust proxy validation for security
    trustProxy: false,
    handler: (req: Request, res: Response): void => {
      const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
      console.log(`Rate limit exceeded for IP: ${clientIP}, Path: ${req.path}`);
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMinutes * 60),
        timestamp: new Date().toISOString()
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Different rate limiters for different endpoints with specific configurations
export const generalLimiter = createRateLimiter({
  max: 200, // More lenient for general endpoints
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'General rate limit exceeded',
    message: 'Too many requests. Please wait before making more requests.',
    retryAfter: 900 // 15 minutes
  }
});

export const aiLimiter = createRateLimiter({
  max: 50, // Stricter for AI endpoints (expensive)
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'AI API rate limit exceeded',
    message: 'Too many AI requests. Please wait before making more requests.',
    retryAfter: 900 // 15 minutes
  },
  handler: (req: Request, res: Response): void => {
    const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
    console.log(`AI rate limit exceeded for IP: ${clientIP}, Path: ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'AI rate limit exceeded',
      message: 'Too many AI requests. These operations are resource-intensive. Please wait before trying again.',
      retryAfter: 900,
      timestamp: new Date().toISOString(),
      suggestion: 'Consider using shorter text or switching to demo mode for testing.'
    });
  }
});

export const uploadLimiter = createRateLimiter({
  max: 20, // Very strict for file uploads
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many file uploads. Please wait before uploading more files.',
    retryAfter: 900
  },
  handler: (req: Request, res: Response): void => {
    const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
    const multerReq = req as MulterRequest;
    console.log(`Upload rate limit exceeded for IP: ${clientIP}, Path: ${req.path}, File: ${multerReq.file?.originalname || 'unknown'}`);
    res.status(429).json({
      success: false,
      error: 'Upload rate limit exceeded',
      message: 'Too many file uploads. File processing is resource-intensive. Please wait before uploading more files.',
      retryAfter: 900,
      timestamp: new Date().toISOString(),
      suggestion: 'Try processing smaller files or use text input instead.'
    });
  }
});

export const healthLimiter = createRateLimiter({
  max: 1000, // Very lenient for health checks
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'Health check rate limit exceeded',
    message: 'Too many health check requests.',
    retryAfter: 900
  }
});

// Export the rate limiter creator for custom use
export default createRateLimiter;

// Rate limiter status interface
export interface RateLimiterStatus {
  enabled: boolean;
  windowMinutes: number;
  limits: {
    general: number;
    ai: number;
    upload: number;
    health: number;
  };
}

// Get current rate limiter configuration
export function getRateLimiterStatus(): RateLimiterStatus {
  const isEnabled = process.env.RATE_LIMIT_ENABLED === 'true';
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15');

  return {
    enabled: isEnabled,
    windowMinutes,
    limits: {
      general: 200,
      ai: 50,
      upload: 20,
      health: 1000
    }
  };
}