# Documentation Index

Welcome to the Mastra Voice Entity Extraction documentation! This index will help you find the information you need.

## 🚀 Getting Started

**New to the project?** Start here:

1. [API Key Summary](../API_KEY_SUMMARY.md) - Quick reference for key management ⭐
2. [Getting Started Guide](guides/GETTING_STARTED.md) - Development setup
3. [Configuration Guide](guides/CONFIGURATION.md) - All settings explained

## 📚 By Category

### 🔐 Security & Keys
- [API Key Summary](../API_KEY_SUMMARY.md) - **Quick reference**
- [Key Management Guide](security/KEY_MANAGEMENT.md) - Detailed security practices
- [DevOps Security](security/DEVOPS_SECURITY.md) - Production deployment security

### ⚙️ Configuration & Setup
- [Configuration Guide](guides/CONFIGURATION.md) - Complete configuration reference
- [Getting Started](guides/GETTING_STARTED.md) - Local development setup
- [Project Summary](guides/PROJECT_SUMMARY.md) - Technical overview

### 🚀 Deployment
- [Quick Deploy](deployment/QUICK_DEPLOY.md) - **10-minute deployment** ⭐
- [Deployment Guide](deployment/DEPLOYMENT.md) - Complete instructions
- [EU Deployment](deployment/DEPLOY_EU.md) - Frankfurt region specific

### 🔧 Development
- [API Documentation](API.md) - Complete API reference
- [Architecture Overview](ARCHITECTURE.md) - System design and components

## 🎯 By Use Case

### "I want to run this locally"
1. [Getting Started](guides/GETTING_STARTED.md)
2. [API Key Summary](../API_KEY_SUMMARY.md)
3. Run: `./scripts/setup-keys.sh`

### "I want to deploy to production" 
1. [DevOps Security](security/DEVOPS_SECURITY.md) - Security first!
2. [Quick Deploy](deployment/QUICK_DEPLOY.md) - Fastest path
3. [Deployment Guide](deployment/DEPLOYMENT.md) - Comprehensive guide

### "I want to understand the architecture"
1. [Project Summary](guides/PROJECT_SUMMARY.md) - High-level overview
2. [Architecture Overview](ARCHITECTURE.md) - Technical details
3. [API Documentation](API.md) - Endpoint details

### "I want to contribute"
1. [Getting Started](guides/GETTING_STARTED.md) - Development setup
2. [Configuration Guide](guides/CONFIGURATION.md) - Understanding settings
3. [Architecture Overview](ARCHITECTURE.md) - System understanding

## 🛠️ Quick Commands

```bash
# Setup and configuration
./scripts/setup-keys.sh     # Interactive API key setup
./scripts/check-config.sh   # Verify configuration
npm run config              # Same as above

# Development
npm run dev                 # Start development server
npm test                    # Run tests  
npm run health              # Test health endpoint

# Deployment
npm run deploy              # Deploy to Koyeb
```

## 📋 Documentation Status

| Document | Status | Last Updated | Purpose |
|----------|--------|--------------|---------|
| [API Key Summary](../API_KEY_SUMMARY.md) | ✅ Current | Latest | Quick key management |
| [Getting Started](guides/GETTING_STARTED.md) | ✅ Current | Latest | Developer onboarding |
| [Configuration Guide](guides/CONFIGURATION.md) | ✅ Current | Latest | Complete config reference |
| [Key Management](security/KEY_MANAGEMENT.md) | ✅ Current | Latest | Security best practices |
| [DevOps Security](security/DEVOPS_SECURITY.md) | ✅ Current | Latest | Production security |
| [Quick Deploy](deployment/QUICK_DEPLOY.md) | ✅ Current | Latest | Fast deployment |
| [API Documentation](API.md) | ✅ Current | Latest | API reference |
| [Architecture](ARCHITECTURE.md) | ✅ Current | Latest | System design |

## 🆘 Need Help?

1. **Configuration issues**: Run `./scripts/check-config.sh`
2. **Setup problems**: Check [Getting Started](guides/GETTING_STARTED.md)
3. **Security questions**: See [DevOps Security](security/DEVOPS_SECURITY.md)
4. **Deployment issues**: Try [Quick Deploy](deployment/QUICK_DEPLOY.md)
5. **Still stuck?**: Create an issue on GitHub

---

**Tip**: Most common questions are answered in the [API Key Summary](../API_KEY_SUMMARY.md) and [Getting Started](guides/GETTING_STARTED.md) guides. 