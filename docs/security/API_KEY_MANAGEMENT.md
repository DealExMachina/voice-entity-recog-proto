# API Key Management Guide

## Overview

This guide covers secure API key management for all environments.

## Quick Reference

### Local Development (.env)
```bash
# 1. Copy template
cp .env.example .env

# 2. Edit with your keys
OPENAI_API_KEY=sk-your-actual-key
MISTRAL_API_KEY=your-mistral-key
AI_PROVIDER=openai
```

### Production (Koyeb Dashboard)
1. Go to [Koyeb Dashboard](https://app.koyeb.com) → Your App → Environment Variables
2. Add:
   - `OPENAI_API_KEY`: `sk-your-production-key`
   - `MISTRAL_API_KEY`: `your-mistral-key`
   - `AI_PROVIDER`: `openai`
   - `NODE_ENV`: `production`
   - `RATE_LIMIT_ENABLED`: `true`

### CI/CD (GitHub Secrets)
Repository → Settings → Secrets and variables → Actions:
- `KOYEB_TOKEN`
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY`

## Security Levels

| Method | Security | Ease | Best For |
|--------|----------|------|----------|
| `.env` file | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Local development |
| Koyeb Dashboard | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Production |
| GitHub Secrets | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | CI/CD |
| CLI Commands | ⭐⭐⭐⭐ | ⭐⭐ | Automation |

## Setup Commands

### Local Development
```bash
# Interactive setup (recommended)
./scripts/setup-keys.sh

# Manual setup
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

### Production Deployment
```bash
# Via CLI (after setting KOYEB_TOKEN)
koyeb service update sales-buddy-web \
  --env OPENAI_API_KEY=sk-your-key \
  --env MISTRAL_API_KEY=your-key \
  --env AI_PROVIDER=openai
```

## Emergency Procedures

### Compromised Key Response
1. **Immediate**: Disable key in provider dashboard
2. **Generate**: New key from provider
3. **Update**: Production environment variables
4. **Verify**: Application functionality

### Provider Switch (Emergency)
```bash
# Switch to demo mode if providers fail
curl -X POST https://your-app.koyeb.app/api/ai/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "demo"}'
```

### Check Configuration
```bash
# Verify current setup
./scripts/check-config.sh

# Check provider status
curl http://localhost:3000/api/ai/status
```

## Best Practices

### Environment Separation
- **Development**: Use test/demo keys
- **Staging**: Separate staging keys  
- **Production**: Production-only keys

### Key Rotation
- **Schedule**: Monthly rotation recommended
- **Process**: Generate new → Update production → Verify → Delete old
- **Documentation**: Track rotation dates

### Access Control
- **Principle**: Least privilege access
- **Team Access**: Use shared secret management
- **Monitoring**: Track API usage and costs

## Security Checklist

### Local Development
- [ ] ✅ `.env` exists and has keys
- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ No keys in source code
- [ ] ✅ Test keys used (not production)

### Production
- [ ] ✅ Keys stored in Koyeb environment variables
- [ ] ✅ Different keys for staging/production
- [ ] ✅ Rate limiting enabled
- [ ] ✅ Usage monitoring configured
- [ ] ✅ Key rotation schedule established

### CI/CD
- [ ] ✅ Keys stored in GitHub Secrets
- [ ] ✅ Environment protection rules enabled
- [ ] ✅ Automated deployment working
- [ ] ✅ No keys in logs or output

## Troubleshooting

### Common Issues
1. **Key not found**: Check environment variable name
2. **Invalid key**: Verify key format and validity
3. **Rate limiting**: Check usage limits
4. **Provider errors**: Verify provider status

### Validation Commands
```bash
# Check environment variables
env | grep API_KEY

# Test API connectivity
npm run health

# Validate configuration
./scripts/check-config.sh
```

## Decision Tree

```
Need API keys?
├── Local development? → Use .env file
├── Production deployment? → Use Koyeb environment variables  
├── CI/CD pipeline? → Use GitHub Secrets
└── Team sharing? → Use cloud platform secrets
``` 