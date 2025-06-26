# API Key Management Guide

This guide covers secure methods for managing API keys in the Mastra Voice Entity Extraction application.

## 🔐 Recommended Approaches (Best to Worst)

### 1. Environment Variables (.env file) - ⭐ **RECOMMENDED**

**Best for**: Local development, testing, small deployments

```bash
# Create .env file in project root
cp .env.example .env

# Edit with your actual keys
nano .env
```

**Advantages**:
- ✅ Keys never committed to git
- ✅ Easy to manage locally
- ✅ Works with most deployment platforms
- ✅ Supports different environments

**Setup**:
```bash
# 1. Copy example file
cp .env.example .env

# 2. Add your keys
echo "OPENAI_API_KEY=sk-your-actual-key" >> .env
echo "MISTRAL_API_KEY=your-mistral-key" >> .env

# 3. Verify .env is in .gitignore
cat .gitignore | grep .env
```

### 2. Cloud Secret Management - ⭐⭐ **PRODUCTION RECOMMENDED**

**Best for**: Production deployments, team environments

#### Koyeb (Our deployment platform)
```bash
# Set via Koyeb dashboard
# Or via CLI:
koyeb service update my-app \
  --env OPENAI_API_KEY=sk-your-key \
  --env MISTRAL_API_KEY=your-key
```

#### Other platforms:
- **Vercel**: Environment Variables in dashboard
- **Netlify**: Site settings → Environment variables
- **Heroku**: Config Vars in dashboard
- **Railway**: Variables tab
- **AWS**: Parameter Store / Secrets Manager

### 3. System Environment Variables - ⭐⭐ **SERVER DEPLOYMENT**

**Best for**: Server deployments, CI/CD

```bash
# Set in shell profile (.bashrc, .zshrc)
export OPENAI_API_KEY=sk-your-key
export MISTRAL_API_KEY=your-key
export AI_PROVIDER=openai

# Or set temporarily
OPENAI_API_KEY=sk-your-key npm run dev
```

### 4. Config Files (NOT RECOMMENDED) - ❌

**Why avoid**: Keys can be accidentally committed

## 🛠️ Setup Instructions

### Local Development Setup

1. **Copy environment template**:
```bash
cp .env.example .env
```

2. **Get your API keys**:

**OpenAI**:
- Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
- Click "Create new secret key"
- Copy the key (starts with `sk-`)

**Mistral AI**:
- Visit [Mistral Console](https://console.mistral.ai/)
- Create account and generate API key
- Copy the key

3. **Edit .env file**:
```bash
# Open in your favorite editor
code .env
# or
nano .env
# or
vim .env
```

4. **Add your keys**:
```bash
# Replace with your actual keys
OPENAI_API_KEY=sk-proj-abc123...your-actual-key
MISTRAL_API_KEY=your-mistral-key-here
AI_PROVIDER=openai
```

5. **Start the application**:
```bash
npm run dev
```

### Production Deployment

#### Option 1: Koyeb Dashboard
1. Go to [Koyeb Dashboard](https://app.koyeb.com)
2. Select your app → Environment variables
3. Add:
   - `OPENAI_API_KEY`: `sk-your-key`
   - `MISTRAL_API_KEY`: `your-key`
   - `AI_PROVIDER`: `openai`
   - `RATE_LIMIT_ENABLED`: `true`

#### Option 2: Koyeb CLI
```bash
# Install Koyeb CLI
curl -fsSL https://get.koyeb.com | bash

# Login
koyeb auth login

# Deploy with environment variables
koyeb service create my-mastra-app \
  --git github.com/yourusername/your-repo \
  --git-branch main \
  --env OPENAI_API_KEY=sk-your-key \
  --env MISTRAL_API_KEY=your-key \
  --env AI_PROVIDER=openai \
  --env RATE_LIMIT_ENABLED=true \
  --ports 3000:http \
  --routes /:3000 \
  --instance-type nano
```

## 🔒 Security Best Practices

### 1. Never Commit Keys to Git

**Check if keys are safe**:
```bash
# Check if .env is ignored
git check-ignore .env

# Check for accidental commits
git log --oneline | head -20
git show --name-only HEAD

# Remove keys from git history if committed
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```

### 2. Use Different Keys per Environment

```bash
# Development .env
OPENAI_API_KEY=sk-dev-key...
AI_PROVIDER=demo

# Staging .env
OPENAI_API_KEY=sk-staging-key...
AI_PROVIDER=openai

# Production (set in deployment platform)
OPENAI_API_KEY=sk-prod-key...
AI_PROVIDER=openai
RATE_LIMIT_ENABLED=true
```

### 3. Rotate Keys Regularly

**Monthly rotation recommended**:
1. Generate new key
2. Update in all environments
3. Test functionality
4. Delete old key

### 4. Monitor Key Usage

**OpenAI**:
- Check usage at [OpenAI Usage](https://platform.openai.com/usage)
- Set usage limits to prevent unexpected charges

**Mistral**:
- Monitor usage in [Mistral Console](https://console.mistral.ai/)

## 🚨 Security Checklist

- [ ] ✅ `.env` file is in `.gitignore`
- [ ] ✅ No keys in source code
- [ ] ✅ Different keys for dev/staging/production
- [ ] ✅ Keys are not in shell history
- [ ] ✅ Team members have their own keys
- [ ] ✅ Usage monitoring is enabled
- [ ] ✅ Keys are rotated monthly
- [ ] ✅ Old keys are deleted after rotation

## 🔍 Troubleshooting

### Check Current Configuration
```bash
# Check if environment variables are loaded
node -e "console.log('OpenAI:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')"
node -e "console.log('Mistral:', process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET')"

# Test API endpoints
curl http://localhost:3000/api/ai/status
curl http://localhost:3000/api/ai/providers
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|---------|
| "No AI providers available" | Missing API keys | Check `.env` file exists and has valid keys |
| "OpenAI not available" | Invalid OpenAI key | Verify key starts with `sk-` and is valid |
| "Environment variables not loaded" | Wrong file location | Ensure `.env` is in project root |
| "Keys visible in logs" | Debugging enabled | Never log actual key values |
| "Rate limit errors immediately" | Wrong rate limit config | Check `RATE_LIMIT_ENABLED` setting |

### Debug Mode
```bash
# Check environment loading (don't use in production)
DEBUG=* npm run dev

# Safe environment check
node -e "
const keys = ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'AI_PROVIDER'];
keys.forEach(key => {
  const value = process.env[key];
  console.log(key + ':', value ? (key.includes('KEY') ? 'SET (' + value.length + ' chars)' : value) : 'NOT SET');
});
"
```

## 📁 File Structure

```
sales-buddy/
├── .env                 # Your actual keys (NEVER commit)
├── .env.example         # Template file (safe to commit)
├── .gitignore          # Must include .env
├── deploy/
│   └── production.env.example
└── src/
    └── ...
```

## 🔄 Migration from Other Methods

### From hardcoded keys:
1. Remove keys from source code
2. Add to `.env` file
3. Use `process.env.KEY_NAME` in code
4. Test functionality

### From config files:
1. Move keys to `.env`
2. Add config files to `.gitignore`
3. Update application to read from environment

### From command line args:
1. Remove from scripts
2. Add to `.env`
3. Update npm scripts if needed

## 🎯 Quick Start Commands

```bash
# Complete setup in 3 commands
cp .env.example .env
echo "OPENAI_API_KEY=sk-your-key" >> .env
npm run dev

# Verify setup
curl http://localhost:3000/api/ai/status
```

---

**Remember**: Keep your API keys secret, rotate them regularly, and never commit them to version control! 