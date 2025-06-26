# API Key Management - Quick Reference

## 🎯 Summary: How to Manage Keys Securely

### 🥇 **RECOMMENDED: Environment Variables (.env)**

**For Local Development**:
```bash
# 1. Copy template
cp .env.example .env

# 2. Edit with your keys
OPENAI_API_KEY=sk-your-actual-key
MISTRAL_API_KEY=your-mistral-key
AI_PROVIDER=openai
```

**Pros**: ✅ Never committed to git ✅ Easy to manage ✅ Platform independent
**Cons**: ❌ Manual setup required ❌ Not shared across team

---

### 🏆 **BEST FOR PRODUCTION: Cloud Platform Secrets**

#### Koyeb (Our Deployment Platform)

**Method 1: Dashboard** (Easiest)
1. Go to [Koyeb Dashboard](https://app.koyeb.com) → Your App → Environment Variables
2. Add:
   - `OPENAI_API_KEY`: `sk-your-production-key`
   - `MISTRAL_API_KEY`: `your-mistral-key`
   - `AI_PROVIDER`: `openai`
   - `RATE_LIMIT_ENABLED`: `true`

**Method 2: CLI** (Automated)
```bash
koyeb service update mastra-voice-app \
  --env OPENAI_API_KEY=sk-your-key \
  --env MISTRAL_API_KEY=your-key \
  --env AI_PROVIDER=openai
```

---

### 🔄 **CI/CD: GitHub Secrets**

**For Automated Deployments**:
1. GitHub Repository → Settings → Secrets and variables → Actions
2. Add Repository Secrets:
   - `OPENAI_API_KEY_PROD`
   - `MISTRAL_API_KEY_PROD`  
   - `OPENAI_API_KEY_STAGING`
   - `MISTRAL_API_KEY_STAGING`
   - `KOYEB_API_TOKEN`

**Usage in GitHub Actions**:
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_PROD }}
  MISTRAL_API_KEY: ${{ secrets.MISTRAL_API_KEY_PROD }}
```

---

## 🚀 Quick Setup Commands

### Local Development (3 commands)
```bash
cp .env.example .env
echo "OPENAI_API_KEY=sk-your-key" >> .env  
npm run dev
```

### Production Setup (Dashboard)
1. Push code to GitHub
2. Connect GitHub repo to Koyeb
3. Add environment variables in Koyeb dashboard
4. Deploy automatically

### Production Setup (CLI)
```bash
# Install Koyeb CLI
curl -fsSL https://get.koyeb.com | bash

# Deploy with secrets
koyeb service create mastra-voice-app \
  --git github.com/yourusername/sales-buddy \
  --env OPENAI_API_KEY=sk-your-key \
  --env AI_PROVIDER=openai \
  --regions fra
```

---

## 🔐 Security Levels

| Method | Security | Ease | Best For |
|--------|----------|------|----------|
| `.env` file | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Local dev |
| Koyeb Dashboard | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Production |
| GitHub Secrets | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | CI/CD |
| CLI Commands | ⭐⭐⭐⭐ | ⭐⭐ | Automation |
| Config Files | ⭐ | ⭐⭐⭐⭐ | ❌ **AVOID** |

---

## 🆘 Emergency Commands

**Check current setup**:
```bash
./check-config.sh
```

**Rotate compromised key**:
```bash
# 1. Generate new key at provider
# 2. Update production immediately
koyeb service update mastra-voice-app --env OPENAI_API_KEY=sk-new-key
```

**Switch to backup provider**:
```bash
curl -X POST https://your-app.koyeb.app/api/ai/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "demo"}'
```

---

## 📋 Security Checklist

**Local Development**:
- [ ] ✅ `.env` exists and has your keys
- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ No keys in source code

**Production**:
- [ ] ✅ Keys stored in Koyeb environment variables
- [ ] ✅ Different keys for staging/production
- [ ] ✅ Rate limiting enabled
- [ ] ✅ Usage monitoring configured

**CI/CD**:
- [ ] ✅ Keys stored in GitHub Secrets
- [ ] ✅ Environment protection rules enabled
- [ ] ✅ Automated deployment working

---

## 🎯 Decision Tree

```
Need API keys? 
├── Local development? → Use .env file
├── Production deployment? → Use Koyeb environment variables
├── CI/CD pipeline? → Use GitHub Secrets
└── Team sharing? → Use cloud platform secrets
```

---

## 📞 Quick Help

- **Setup**: `./setup-keys.sh` (Interactive setup)
- **Check**: `./check-config.sh` (Verify configuration)
- **Docs**: `KEY_MANAGEMENT.md` (Detailed guide)
- **DevOps**: `DEVOPS_SECURITY.md` (Production security)
- **Config**: `CONFIGURATION.md` (All settings)

**Emergency**: If keys are compromised, disable them immediately in the provider dashboard, then update with new keys. 