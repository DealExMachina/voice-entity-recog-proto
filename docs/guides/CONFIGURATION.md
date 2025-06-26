# Configuration Guide

This guide explains how to configure the Mastra Voice Entity Extraction application with different AI providers and rate limiting settings.

## 🔑 API Keys Setup

### OpenAI Configuration

1. **Get your API key**:
   - Visit [OpenAI API](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Set environment variable**:
   ```bash
   export OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

3. **Features available with OpenAI**:
   - Audio transcription (Whisper model)
   - Entity extraction (GPT-4o-mini model)
   - High accuracy results
   - Production-ready performance

### Mistral AI Configuration

1. **Get your API key**:
   - Visit [Mistral AI Console](https://console.mistral.ai/)
   - Create an account and generate an API key
   - Copy the key

2. **Set environment variable**:
   ```bash
   export MISTRAL_API_KEY=your-mistral-api-key-here
   ```

3. **Features available with Mistral**:
   - Entity extraction (Mistral-small model)
   - Cost-effective alternative to OpenAI
   - No audio transcription (falls back to demo)
   - Good performance for text processing

### Demo Mode (No API Key Required)

Demo mode is available without any API keys and provides:
- Pattern-matching based entity extraction
- Sample transcription text
- Perfect for testing and development
- No external API calls or costs

## 🌍 AI Provider Selection

### Setting Default Provider

```bash
# Set in environment or .env file
AI_PROVIDER=openai    # Options: openai, mistral, demo
```

### Runtime Provider Switching

You can switch providers on-demand via:

1. **Web Interface**: Use the dropdown in the top-right corner
2. **API Endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/ai/provider \
     -H "Content-Type: application/json" \
     -d '{"provider": "mistral"}'
   ```

### Provider Availability Logic

The application automatically determines available providers:

```javascript
// Provider priority and fallback
if (OPENAI_API_KEY) → OpenAI available
if (MISTRAL_API_KEY) → Mistral available
Always available → Demo mode

// Auto-fallback on errors
OpenAI error → Fallback to demo
Mistral error → Fallback to demo
Invalid provider → Stay on current provider
```

## 🛡️ Rate Limiting Configuration

### Environment Variables

```bash
# Enable/disable rate limiting globally
RATE_LIMIT_ENABLED=true

# Global settings (can be overridden per endpoint)
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
RATE_LIMIT_WINDOW_MINUTES=15     # Time window in minutes
```

### Endpoint-Specific Limits

The application applies different limits based on endpoint type:

| Endpoint Type | Default Limit | Window | Purpose |
|---------------|---------------|---------|---------|
| **AI Operations** | 50 req | 15 min | Expensive AI processing |
| **File Uploads** | 20 req | 15 min | Resource-intensive uploads |
| **General API** | 200 req | 15 min | Standard API operations |
| **Health Checks** | 1000 req | 15 min | Monitoring/health |

### Custom Rate Limit Configuration

You can customize limits for production environments:

```bash
# For high-traffic production
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=500      # Higher general limit
RATE_LIMIT_WINDOW_MINUTES=60     # Longer window

# For development/testing
RATE_LIMIT_ENABLED=false         # Disable rate limiting

# For strict API protection
RATE_LIMIT_MAX_REQUESTS=50       # Lower limit
RATE_LIMIT_WINDOW_MINUTES=5      # Shorter window
```

## 📁 Environment File Examples

### Development `.env`
```bash
# AI Providers
OPENAI_API_KEY=sk-your-dev-openai-key
MISTRAL_API_KEY=your-dev-mistral-key
AI_PROVIDER=demo

# Server
PORT=3000
DB_PATH=./data/entities.db
NODE_ENV=development

# Rate Limiting (Relaxed for development)
RATE_LIMIT_ENABLED=false
```

### Production `.env`
```bash
# AI Providers
OPENAI_API_KEY=sk-your-prod-openai-key
MISTRAL_API_KEY=your-prod-mistral-key
AI_PROVIDER=openai

# Server
PORT=3000
DB_PATH=/app/data/entities.db
NODE_ENV=production

# Rate Limiting (Strict for production)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MINUTES=15
```

### Testing `.env`
```bash
# AI Providers (Demo only for testing)
AI_PROVIDER=demo

# Server
PORT=3001
DB_PATH=./data/test-entities.db
NODE_ENV=test

# Rate Limiting (Disabled for testing)
RATE_LIMIT_ENABLED=false
```

## 🔧 Advanced Configuration

### Database Configuration

```bash
# Database settings
DB_PATH=./data/entities.db           # SQLite file path
DB_MAX_CONNECTIONS=10                # Connection pool size
DB_TIMEOUT=30000                     # Query timeout (ms)
```

### Server Configuration

```bash
# Server tuning
PORT=3000                            # Server port
CORS_ORIGIN=*                        # CORS allowed origins
MAX_UPLOAD_SIZE=10mb                 # File upload limit
WEBSOCKET_HEARTBEAT=30000           # WebSocket ping interval
```

### Logging Configuration

```bash
# Logging levels
LOG_LEVEL=info                       # debug, info, warn, error
LOG_FORMAT=combined                  # Common log formats
RATE_LIMIT_LOG=true                 # Log rate limit events
```

## 🚨 Security Best Practices

### API Key Security

1. **Never commit API keys** to version control
2. **Use environment variables** or secure secret management
3. **Rotate keys regularly** (monthly recommended)
4. **Use different keys** for dev/staging/production
5. **Monitor API usage** to detect unauthorized access

### Rate Limiting Best Practices

1. **Enable rate limiting** in production
2. **Set conservative limits** initially
3. **Monitor rate limit hits** and adjust as needed
4. **Use different limits** for different user tiers
5. **Implement IP whitelisting** for trusted sources

### Environment Separation

```bash
# Development
AI_PROVIDER=demo                     # Use demo mode
RATE_LIMIT_ENABLED=false            # Disable for testing

# Staging
AI_PROVIDER=openai                   # Use real AI but with test keys
RATE_LIMIT_ENABLED=true             # Test rate limiting
RATE_LIMIT_MAX_REQUESTS=50          # Lower limits for testing

# Production
AI_PROVIDER=openai                   # Production AI provider
RATE_LIMIT_ENABLED=true             # Always enabled
RATE_LIMIT_MAX_REQUESTS=200         # Production-appropriate limits
```

## 📊 Monitoring and Debugging

### Check Current Configuration

```bash
# Check AI provider status
curl http://localhost:3000/api/ai/status

# Check rate limit headers
curl -I http://localhost:3000/api/health

# Check available providers
curl http://localhost:3000/api/ai/providers
```

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "OpenAI not available" | Missing/invalid API key | Check `OPENAI_API_KEY` environment variable |
| "Rate limit exceeded" | Too many requests | Wait or increase rate limits |
| "Provider switch failed" | Invalid provider name | Use: `openai`, `mistral`, or `demo` |
| "Transcription unavailable" | Mistral selected | Switch to OpenAI or use demo mode |
| "Demo mode active" | No API keys provided | Add API keys to enable AI providers |

### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm run dev

# Check environment variables
echo $OPENAI_API_KEY | head -c 10    # Shows first 10 chars
echo $AI_PROVIDER                    # Shows current provider
```

## 🔄 Migration Guide

### From Demo to Production

1. **Get API keys** from OpenAI/Mistral
2. **Set environment variables** with real keys
3. **Change AI_PROVIDER** from `demo` to `openai`
4. **Enable rate limiting** with appropriate limits
5. **Test thoroughly** before going live

### Provider Migration

```bash
# From OpenAI to Mistral (cost savings)
# 1. Get Mistral API key
export MISTRAL_API_KEY=your-key

# 2. Switch provider
curl -X POST localhost:3000/api/ai/provider \
  -d '{"provider": "mistral"}'

# 3. Update default in environment
AI_PROVIDER=mistral
```

## 📞 Support

For configuration issues:
1. Check this guide first
2. Verify environment variables: `printenv | grep -E "(OPENAI|MISTRAL|AI_PROVIDER|RATE_LIMIT)"`
3. Test API endpoints manually
4. Check application logs
5. Create an issue with configuration details (redact API keys!)

---

**Security Note**: Always keep your API keys secure and never share them publicly! 