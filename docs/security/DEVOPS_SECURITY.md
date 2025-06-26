# DevOps Security: API Key Management

This guide covers secure API key management for production deployments using Koyeb, GitHub Actions, and other CI/CD platforms.

## 🏗️ Production Architecture

```
GitHub Repository (Code)
         ↓
GitHub Actions (CI/CD)
         ↓ 
Koyeb Platform (Deployment)
         ↓
Environment Variables (Secrets)
         ↓
Running Application
```

## 🔐 Koyeb Platform Setup

### Method 1: Koyeb Dashboard (Recommended)

**Step 1: Access Dashboard**
1. Go to [Koyeb Dashboard](https://app.koyeb.com)
2. Navigate to your application
3. Go to **Settings** → **Environment Variables**

**Step 2: Add Secrets**
```bash
# Required Variables
OPENAI_API_KEY=sk-your-production-openai-key
MISTRAL_API_KEY=your-production-mistral-key
AI_PROVIDER=openai
NODE_ENV=production

# Security Settings
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MINUTES=15

# Optional
LOG_LEVEL=info
```

**Step 3: Verify Security**
- ✅ Variables are encrypted at rest
- ✅ Only accessible to your app
- ✅ Not visible in logs
- ✅ Can be rotated without code changes

### Method 2: Koyeb CLI

**Install Koyeb CLI**:
```bash
curl -fsSL https://get.koyeb.com | bash
export PATH=$PATH:$HOME/.koyeb/bin
koyeb auth login
```

**Deploy with Secrets**:
```bash
# Create service with environment variables
koyeb service create mastra-voice-app \
  --git github.com/yourusername/sales-buddy \
  --git-branch main \
  --env OPENAI_API_KEY=sk-your-production-key \
  --env MISTRAL_API_KEY=your-mistral-key \
  --env AI_PROVIDER=openai \
  --env NODE_ENV=production \
  --env RATE_LIMIT_ENABLED=true \
  --env RATE_LIMIT_MAX_REQUESTS=200 \
  --env RATE_LIMIT_WINDOW_MINUTES=15 \
  --ports 3000:http \
  --routes /:3000 \
  --instance-type nano \
  --regions fra
```

**Update Existing Service**:
```bash
# Update environment variables
koyeb service update mastra-voice-app \
  --env OPENAI_API_KEY=sk-new-production-key \
  --env MISTRAL_API_KEY=new-mistral-key

# Verify deployment
koyeb service logs mastra-voice-app
```

## 🐙 GitHub Secrets Setup

### GitHub Repository Secrets

**Step 1: Access Repository Settings**
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

**Step 2: Add Production Secrets**
```bash
# Repository Secrets (for GitHub Actions)
OPENAI_API_KEY_PROD=sk-your-production-openai-key
MISTRAL_API_KEY_PROD=your-production-mistral-key
KOYEB_API_TOKEN=your-koyeb-api-token

# Staging Secrets
OPENAI_API_KEY_STAGING=sk-your-staging-openai-key
MISTRAL_API_KEY_STAGING=your-staging-mistral-key
```

**Step 3: Environment-Specific Secrets**
```bash
# Production Environment
PROD_AI_PROVIDER=openai
PROD_RATE_LIMIT_ENABLED=true
PROD_RATE_LIMIT_MAX_REQUESTS=200

# Staging Environment  
STAGING_AI_PROVIDER=mistral
STAGING_RATE_LIMIT_ENABLED=true
STAGING_RATE_LIMIT_MAX_REQUESTS=50
```

name: Deploy to Koyeb

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  # These will be overridden by environment-specific values
  NODE_ENV: production

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests with demo mode
      run: npm test
      env:
        AI_PROVIDER: demo
        RATE_LIMIT_ENABLED: false

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Koyeb Staging
      uses: koyeb/actions-deploy@v1
      with:
        api_token: ${{ secrets.KOYEB_API_TOKEN }}
        service_name: mastra-voice-staging
        service_type: web
        git_repository: ${{ github.repository }}
        git_branch: main
        env_vars: |
          OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY_STAGING }}
          MISTRAL_API_KEY=${{ secrets.MISTRAL_API_KEY_STAGING }}
          AI_PROVIDER=${{ vars.STAGING_AI_PROVIDER }}
          NODE_ENV=staging
          RATE_LIMIT_ENABLED=${{ vars.STAGING_RATE_LIMIT_ENABLED }}
          RATE_LIMIT_MAX_REQUESTS=${{ vars.STAGING_RATE_LIMIT_MAX_REQUESTS }}
        instance_type: nano
        regions: fra

  deploy-production:
    needs: [test, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Koyeb Production
      uses: koyeb/actions-deploy@v1
      with:
        api_token: ${{ secrets.KOYEB_API_TOKEN }}
        service_name: mastra-voice-production
        service_type: web
        git_repository: ${{ github.repository }}
        git_branch: main
        env_vars: |
          OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY_PROD }}
          MISTRAL_API_KEY=${{ secrets.MISTRAL_API_KEY_PROD }}
          AI_PROVIDER=${{ vars.PROD_AI_PROVIDER }}
          NODE_ENV=production
          RATE_LIMIT_ENABLED=${{ vars.PROD_RATE_LIMIT_ENABLED }}
          RATE_LIMIT_MAX_REQUESTS=${{ vars.PROD_RATE_LIMIT_MAX_REQUESTS }}
          RATE_LIMIT_WINDOW_MINUTES=15
          LOG_LEVEL=info
        instance_type: nano
        regions: fra
    
    - name: Verify Deployment
      run: |
        echo "Waiting for deployment..."
        sleep 30
        
        # Test health endpoint
        curl -f https://mastra-voice-production-yourname.koyeb.app/api/health
        
        # Test AI status
        curl -f https://mastra-voice-production-yourname.koyeb.app/api/ai/status

```

## 🔒 Security Best Practices

### 1. Environment Separation

```bash
# Development (Local)
AI_PROVIDER=demo
RATE_LIMIT_ENABLED=false
LOG_LEVEL=debug

# Staging (Testing)
AI_PROVIDER=mistral      # Cheaper for testing
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=50
LOG_LEVEL=info

# Production (Live)
AI_PROVIDER=openai      # Best performance
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=200
LOG_LEVEL=warn
```

### 2. Key Rotation Strategy

**Monthly Rotation Schedule**:
```bash
# Week 1: Generate new keys
# Week 2: Update staging environment
# Week 3: Update production environment  
# Week 4: Delete old keys
```

**Rotation Process**:
```bash
# 1. Generate new OpenAI key
# Visit: https://platform.openai.com/api-keys

# 2. Update GitHub Secrets
# GitHub → Settings → Secrets → Update OPENAI_API_KEY_PROD

# 3. Update Koyeb via CLI
koyeb service update mastra-voice-production \
  --env OPENAI_API_KEY=sk-new-production-key

# 4. Verify deployment
curl https://your-app.koyeb.app/api/ai/status

# 5. Delete old key from OpenAI dashboard
```

### 3. Access Control

**GitHub Repository Settings**:
- ✅ Enable branch protection on `main`
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Restrict who can manage secrets

**Koyeb Access Control**:
- ✅ Use team accounts, not personal
- ✅ Assign minimal necessary permissions
- ✅ Enable 2FA for all team members
- ✅ Regular access reviews

### 4. Monitoring & Alerts

**Set up monitoring for**:
```bash
# API Key Usage (OpenAI Dashboard)
# Rate Limit Violations (Application logs)
# Unauthorized access attempts
# Environment variable changes
```

## 🚀 Step-by-Step Setup Guide

### Phase 1: GitHub Setup

1. **Fork/Clone Repository**:
```bash
git clone https://github.com/yourusername/sales-buddy
cd sales-buddy
```

2. **Set GitHub Secrets**:
   - Go to GitHub → Settings → Secrets and variables → Actions
   - Add secrets:
     - `KOYEB_API_TOKEN`
     - `OPENAI_API_KEY_PROD`
     - `MISTRAL_API_KEY_PROD`
     - `OPENAI_API_KEY_STAGING`
     - `MISTRAL_API_KEY_STAGING`

3. **Set GitHub Variables**:
   - Add variables:
     - `PROD_AI_PROVIDER=openai`
     - `PROD_RATE_LIMIT_ENABLED=true`
     - `PROD_RATE_LIMIT_MAX_REQUESTS=200`
     - `STAGING_AI_PROVIDER=mistral`
     - `STAGING_RATE_LIMIT_ENABLED=true`
     - `STAGING_RATE_LIMIT_MAX_REQUESTS=50`

### Phase 2: Koyeb Setup

1. **Create Koyeb Account**:
   - Visit [Koyeb](https://www.koyeb.com)
   - Create account and verify email

2. **Generate API Token**:
   - Go to Koyeb Dashboard → API
   - Create new token
   - Add to GitHub secrets as `KOYEB_API_TOKEN`

3. **Create Environments**:
```bash
# Staging environment
koyeb service create mastra-voice-staging \
  --git github.com/yourusername/sales-buddy \
  --git-branch main \
  --env NODE_ENV=staging \
  --env AI_PROVIDER=mistral \
  --regions fra

# Production environment  
koyeb service create mastra-voice-production \
  --git github.com/yourusername/sales-buddy \
  --git-branch main \
  --env NODE_ENV=production \
  --env AI_PROVIDER=openai \
  --regions fra
```

### Phase 3: API Keys Setup

1. **OpenAI Keys**:
   - Production: Create at [OpenAI](https://platform.openai.com/api-keys)
   - Set usage limits: $50/month for production
   - Staging: Create separate key with $10/month limit

2. **Mistral Keys**:
   - Create at [Mistral Console](https://console.mistral.ai/)
   - Set up billing alerts

3. **Add to Koyeb**:
```bash
# Update staging
koyeb service update mastra-voice-staging \
  --env OPENAI_API_KEY=sk-staging-key \
  --env MISTRAL_API_KEY=staging-mistral-key

# Update production
koyeb service update mastra-voice-production \
  --env OPENAI_API_KEY=sk-production-key \
  --env MISTRAL_API_KEY=production-mistral-key
```

## 🔍 Verification & Testing

### 1. Test GitHub Actions

```bash
# Push to trigger deployment
git add .
git commit -m "feat: setup production deployment"
git push origin main

# Check Actions tab in GitHub
# Verify both staging and production deploy
```

### 2. Test Environments

```bash
# Test staging
curl https://mastra-voice-staging-yourname.koyeb.app/api/health
curl https://mastra-voice-staging-yourname.koyeb.app/api/ai/status

# Test production
curl https://mastra-voice-production-yourname.koyeb.app/api/health
curl https://mastra-voice-production-yourname.koyeb.app/api/ai/status
```

### 3. Test AI Functionality

```bash
# Test entity extraction
curl -X POST https://your-production-app.koyeb.app/api/extract-entities \
  -H "Content-Type: application/json" \
  -d '{"text": "Meet John Smith from Acme Corp tomorrow at 3 PM"}'

# Test provider switching
curl -X POST https://your-production-app.koyeb.app/api/ai/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "mistral"}'
```

## 🚨 Security Checklist

- [ ] ✅ API keys stored in GitHub Secrets (not repository)
- [ ] ✅ Different keys for staging/production
- [ ] ✅ Koyeb environment variables encrypted
- [ ] ✅ Branch protection enabled on main
- [ ] ✅ 2FA enabled on all accounts
- [ ] ✅ Rate limiting enabled in production
- [ ] ✅ Monitoring/alerting configured
- [ ] ✅ Key rotation schedule planned
- [ ] ✅ Access permissions minimized
- [ ] ✅ Logs don't contain sensitive data

## 🚨 Emergency Procedures

### Key Compromise Response

1. **Immediate Actions**:
```bash
# 1. Disable compromised key in provider dashboard
# 2. Generate new key
# 3. Update GitHub secrets
# 4. Trigger immediate redeployment
git commit --allow-empty -m "emergency: rotate compromised keys"
git push origin main
```

2. **Investigation**:
```bash
# Check usage logs
# Review access logs
# Update incident response documentation
```

### Service Outage Response

```bash
# 1. Check Koyeb status
koyeb service get mastra-voice-production

# 2. Check logs
koyeb service logs mastra-voice-production

# 3. Rollback if needed
koyeb service update mastra-voice-production --git-sha previous-commit-hash

# 4. Switch to backup provider
curl -X POST https://your-app.koyeb.app/api/ai/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "demo"}'
```

## 📚 Additional Resources

- [Koyeb Documentation](https://www.koyeb.com/docs)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Mistral AI Documentation](https://docs.mistral.ai/)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regular reviews and updates are essential! 