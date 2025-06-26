import rateLimit from 'express-rate-limit';

// Rate limiting configuration
const createRateLimiter = (options = {}) => {
  const isRateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
  
  if (!isRateLimitEnabled) {
    // Return a no-op middleware if rate limiting is disabled
    return (req, res, next) => next();
  }

  const defaultOptions = {
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window default
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(((parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(((parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000) / 1000)
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Different rate limiters for different endpoints
export const generalLimiter = createRateLimiter({
  max: 200, // More lenient for general endpoints
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const aiLimiter = createRateLimiter({
  max: 50, // Stricter for AI endpoints (expensive)
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'AI API rate limit exceeded',
    message: 'Too many AI requests. Please wait before making more requests.',
    retryAfter: 900 // 15 minutes
  }
});

export const uploadLimiter = createRateLimiter({
  max: 20, // Very strict for file uploads
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many file uploads. Please wait before uploading more files.',
    retryAfter: 900
  }
});

export const healthLimiter = createRateLimiter({
  max: 1000, // Very lenient for health checks
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Export the rate limiter creator for custom use
export default createRateLimiter; 