# Deploy to EU Frankfurt 🇪🇺

Quick deployment guide for deploying your Mastra Voice Entity Extraction prototype to **Koyeb EU Frankfurt** region.

## 🚀 Quick Deploy to EU Frankfurt

### Option 1: Koyeb Dashboard (Recommended)

1. **Push to GitHub** (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "Mastra Voice Entity Extraction - EU deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mastra-voice-entity-extraction.git
   git push -u origin main
   ```

2. **Deploy via Koyeb Dashboard**:
   - Go to [app.koyeb.com](https://app.koyeb.com)
   - Click **"Create App"**
   - Select **"Deploy from GitHub"**
   - Choose your repository
   - Configure:
     ```
     Region: Frankfurt 🇩🇪
     Instance: Nano (Free tier)
     Port: 3000
     Build: npm ci
     Run: npm start
     ```

3. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3000
   DB_PATH=/tmp/entities.db
   OPENAI_API_KEY=your_openai_key_here
   ```

### Option 2: Automated CLI Deployment

```bash
# Set your credentials
export KOYEB_API_TOKEN=your_koyeb_token
export OPENAI_API_KEY=your_openai_key

# Deploy to EU Frankfurt
./scripts/deploy-koyeb.sh
```

The script is pre-configured for Frankfurt region (`fra`).

## 🌍 EU Benefits

**Why deploy in EU Frankfurt?**
- ✅ **GDPR Compliance**: Data stays in EU
- ✅ **Lower Latency**: Faster for European users
- ✅ **Data Residency**: EU data protection laws
- ✅ **Regional Performance**: Optimized for EU traffic

## 📍 Configuration Details

### Service Configuration
```yaml
Region: Frankfurt (fra)
Instance: Nano (1 vCPU, 512MB RAM)
Auto-scaling: 1-3 instances
Health checks: /api/health
SSL: Automatic HTTPS
```

### Network & Security
- **Location**: Germany (Frankfurt)
- **SSL/TLS**: Automatic certificate
- **Domain**: `*.koyeb.app` with EU endpoint
- **DDoS Protection**: Included
- **IPv6**: Supported

## 🔧 EU-Specific Considerations

### Data Storage
```javascript
// Database location (ephemeral for demo)
DB_PATH=/tmp/entities.db

// For production, consider EU-based database:
// - PostgreSQL on AWS EU-Central-1
// - MongoDB Atlas EU-West-1
// - Supabase EU region
```

### GDPR Compliance
The application includes:
- No persistent user data storage (ephemeral database)
- No user tracking or analytics
- Voice data processed in memory only
- OpenAI API calls follow their data policies

## 🚀 Deploy Now

**Ready to deploy?**
```bash
# Quick deploy to EU Frankfurt
export OPENAI_API_KEY=your_key_here
export KOYEB_API_TOKEN=your_token_here
./scripts/deploy-koyeb.sh
```

**Your app will be live at:**
```
https://mastra-voice-entity-extraction-[id].koyeb.app
```

**Hosted in:** 🇩🇪 Frankfurt, Germany

## 🎯 Next Steps

1. **Test the deployment**: Check health endpoint
2. **Verify EU hosting**: Confirm region in Koyeb dashboard
3. **Monitor performance**: EU-optimized metrics
4. **Scale if needed**: Upgrade instance for production

**European users will enjoy:**
- ⚡ Faster response times
- 🔒 EU data protection
- 🌍 Regional compliance
- 📊 Lower latency for voice processing

Perfect for European businesses and GDPR-compliant deployments! 🇪🇺 