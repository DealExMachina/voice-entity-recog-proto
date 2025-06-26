// Error handling utilities for user-friendly messages and graceful degradation

export class AppError extends Error {
  constructor(message, type = 'general', statusCode = 500, userMessage = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
    this.timestamp = new Date().toISOString();
  }

  getDefaultUserMessage(type) {
    const messages = {
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

export class ErrorHandler {
  static handleApiError(error, req, res, next) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.type,
        message: error.userMessage,
        timestamp: error.timestamp,
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message,
          stack: error.stack 
        })
      });
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'validation',
        message: 'Please check your input and try again.',
        details: error.message
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        error: 'network',
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }

    if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        success: false,
        error: 'timeout',
        message: 'The operation took too long to complete. Please try again.'
      });
    }

    // Rate limiting error
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'ratelimit',
        message: 'Too many requests. Please wait before trying again.',
        retryAfter: error.retryAfter || 900
      });
    }

    // Default error response
    res.status(500).json({
      success: false,
      error: 'general',
      message: 'An unexpected error occurred. Please try again.',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message 
      })
    });
  }

  static wrapAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static createTimeoutWrapper(timeoutMs = 30000) {
    return (fn) => {
      return async (...args) => {
        return Promise.race([
          fn(...args),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new AppError('Operation timed out', 'timeout', 408));
            }, timeoutMs);
          })
        ]);
      };
    };
  }

  static async retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain types of errors
        if (error instanceof AppError && 
            ['validation', 'permission', 'not_found'].includes(error.type)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`Operation failed, attempt ${attempt}/${maxRetries}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError;
  }
}

// Timeout utilities
export const timeouts = {
  AI_REQUEST: 45000,      // 45 seconds for AI operations
  DATABASE: 10000,        // 10 seconds for database operations
  FILE_UPLOAD: 60000,     // 60 seconds for file uploads
  TRANSCRIPTION: 120000,  // 2 minutes for transcription
  GENERAL_API: 30000      // 30 seconds for general API calls
};

// Utility function to create timeout promise
export function withTimeout(promise, timeoutMs, errorType = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError(`Operation timed out after ${timeoutMs}ms`, errorType, 408));
      }, timeoutMs);
    })
  ]);
}

// Circuit breaker for external services
export class CircuitBreaker {
  constructor(threshold = 5, resetTimeout = 60000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
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

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}