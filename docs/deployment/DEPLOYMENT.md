# Deployment Guide - Koyeb

This guide will help you deploy the Mastra Voice Entity Extraction prototype to Koyeb using GitHub integration.

## 🚀 Quick Deployment Steps

### 1. Prepare Your GitHub Repository

1. **Push your code** to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Mastra Voice Entity Extraction prototype"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mastra-voice-entity-extraction.git
   git push -u origin main
   ```

### 2. Set Up Koyeb Account

1. **Sign up** at [koyeb.com](https://www.koyeb.com)
2. **Connect your GitHub account** in the Koyeb dashboard
3. **Get your API token** from Settings > API

### 3. Configure GitHub Secrets

Add these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

```
KOYEB_API_TOKEN=your_koyeb_api_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Deploy via Koyeb Dashboard

1. **Create New App** in Koyeb dashboard
2. **Select GitHub** as source
3. **Choose your repository**: `YOUR_USERNAME/mastra-voice-entity-extraction`
4. **Configure deployment**:
   ```yaml
   App Name: mastra-voice-entity-extraction
   Branch: main
   Build Command: npm ci
   Run Command: npm start
   Port: 3000
   Instance Type: Nano (free tier)
   Region: Frankfurt (fra)
   ```

5. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3000
   DB_PATH=/tmp/entities.db
   OPENAI_API_KEY=your_openai_api_key_here
   ```

### 5. Alternative: Deploy via Koyeb CLI

1. **Install Koyeb CLI**:
   ```bash
   # macOS
   brew install koyeb/tap/koyeb
   
   # Or download from https://github.com/koyeb/koyeb-cli
   ```

2. **Login**:
   ```bash
   koyeb auth login
   ```

3. **Deploy**:
   ```bash
   koyeb app init mastra-voice-entity-extraction
   koyeb service create web \
     --app mastra-voice-entity-extraction \
     --git github.com/YOUR_USERNAME/mastra-voice-entity-extraction \
     --git-branch main \
     --git-build-command "npm ci" \
     --git-run-command "npm start" \
     --port 3000:http \
     --instance-type nano \
     --region fra \
     --env NODE_ENV=production \
     --env PORT=3000 \
     --env DB_PATH=/tmp/entities.db \
     --env OPENAI_API_KEY=your_openai_api_key_here
   ```

## 📋 Deployment Configuration

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Server port |
| `DB_PATH` | `/tmp/entities.db` | Database path (ephemeral) |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key for AI features |

### Service Configuration

```yaml
Instance Type: Nano (1 vCPU, 512MB RAM)
Region: Frankfurt (fra)
Port: 3000 (HTTP)
Health Check: /api/health
Auto-scaling: 1-3 instances
```

## 🔧 Production Optimizations

### 1. Database Persistence

For production, consider using an external database:

```javascript
// Update src/database/duckdb.js
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/entities.db'  // Ephemeral for demo
  : './data/entities.db'; // Persistent for development
```

### 2. Error Handling

The app includes production-ready error handling:
- Graceful fallbacks when OpenAI API is unavailable
- Health check endpoint for monitoring
- Proper logging and status indicators

### 3. Performance

- Uses Node.js 18 for optimal performance
- Nano instance suitable for demo/prototype loads
- Auto-scaling configured for traffic spikes

## 🚦 Monitoring & Health Checks

### Health Check Endpoint
```
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "mcp": "active",
    "mastra": "ready"
  }
}
```

### Logs
Monitor deployment via Koyeb dashboard:
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, request metrics
- **Health**: Service health status

## 🌐 Custom Domain (Optional)

1. **Add Custom Domain** in Koyeb dashboard
2. **Configure DNS** to point to Koyeb
3. **SSL Certificate** automatically provisioned

## 🔄 Continuous Deployment

The GitHub Actions workflow automatically:
1. **Runs tests** on every push
2. **Validates** the application
3. **Triggers deployment** on main branch pushes

### Manual Deployment Trigger

Force a new deployment:
```bash
git commit --allow-empty -m "Trigger deployment"
git push origin main
```

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check Node.js version (should be 18+)
   - Verify package.json scripts
   - Review build logs in Koyeb dashboard

2. **Environment Variables**:
   - Ensure OPENAI_API_KEY is set correctly
   - Check variable names match exactly

3. **Health Check Failures**:
   - Verify server starts on correct port
   - Check /api/health endpoint responds

4. **Database Issues**:
   - Uses ephemeral storage (/tmp) - data resets on restart
   - For persistence, integrate external database service

### Getting Help

- **Koyeb Documentation**: [docs.koyeb.com](https://docs.koyeb.com)
- **GitHub Issues**: Report issues in your repository
- **Koyeb Support**: Available via dashboard

## 🎉 Success!

Once deployed, your app will be available at:
```
https://mastra-voice-entity-extraction-YOUR_KOYEB_ID.koyeb.app
```

Features available:
- ✅ Voice entity extraction
- ✅ Real-time web interface  
- ✅ API endpoints
- ✅ Database integration
- ✅ Beautiful UI with Tailwind CSS

**Next Steps**:
1. Test the deployed application
2. Share the URL with stakeholders
3. Monitor usage via Koyeb dashboard
4. Consider scaling for production use 