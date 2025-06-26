# Quick Deploy Checklist ✅

Follow this checklist to deploy your Mastra Voice Entity Extraction prototype to Koyeb in under 10 minutes.

## Prerequisites ✅
- [ ] GitHub account
- [ ] OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- [ ] Koyeb account ([sign up here](https://www.koyeb.com))

## 1. Push to GitHub (2 minutes) 📤

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Mastra Voice Entity Extraction prototype"

# Create main branch
git branch -M main

# Add GitHub remote (replace with your repository)
git remote add origin https://github.com/YOUR_USERNAME/mastra-voice-entity-extraction.git

# Push to GitHub
git push -u origin main
```

## 2. Deploy via Koyeb Dashboard (5 minutes) 🚀

### Step 1: Create App
1. Go to [Koyeb Dashboard](https://app.koyeb.com)
2. Click **"Create App"**
3. Choose **"Deploy from GitHub"**

### Step 2: Configure Repository
```
Repository: YOUR_USERNAME/mastra-voice-entity-extraction
Branch: main
```

### Step 3: Build Settings
```
Build Command: npm ci
Run Command: npm start
```

### Step 4: Service Settings
```
App Name: mastra-voice-entity-extraction
Port: 3000
Instance Type: Nano (Free tier)
Region: Frankfurt
```

### Step 5: Environment Variables
Add these variables in the Koyeb dashboard:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_PATH` | `/tmp/entities.db` |
| `OPENAI_API_KEY` | `your_openai_api_key_here` |

### Step 6: Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for build and deployment
3. Your app will be live! 🎉

## 3. Verify Deployment (1 minute) ✅

### Test Your Live App
Your app will be available at:
```
https://mastra-voice-entity-extraction-[random-id].koyeb.app
```

**Quick Tests:**
- [ ] Health check: `https://your-app.koyeb.app/api/health`
- [ ] Web interface loads
- [ ] Text entity extraction works
- [ ] Database shows extracted entities

## 4. Monitor & Manage 📊

### Koyeb Dashboard
- **Logs**: View real-time application logs
- **Metrics**: Monitor CPU, memory, requests
- **Scaling**: Automatic scaling based on traffic
- **Custom Domain**: Add your own domain (optional)

### Useful Commands
```bash
# Check deployment status
curl https://your-app.koyeb.app/api/health

# Test entity extraction
curl -X POST https://your-app.koyeb.app/api/extract-entities \
  -H "Content-Type: application/json" \
  -d '{"text": "Meeting with John Smith from Acme Corp tomorrow at 3 PM"}'
```

## Troubleshooting 🛠️

### Common Issues & Solutions

**❌ Build fails with "npm ci" error**
- ✅ Check Node.js version in package.json (should be 18+)
- ✅ Verify all dependencies are in package.json

**❌ App starts but health check fails**
- ✅ Ensure PORT environment variable is set to 3000
- ✅ Check application logs in Koyeb dashboard

**❌ Entity extraction returns errors**
- ✅ Verify OPENAI_API_KEY is set correctly
- ✅ Check OpenAI API key has sufficient credits

**❌ Database errors in logs**
- ✅ Normal for ephemeral storage - data resets on restart
- ✅ For persistence, consider external database service

## Success! 🎉

Your Mastra Voice Entity Extraction prototype is now live and accessible worldwide!

**What you've deployed:**
- ✅ Beautiful web interface with voice input
- ✅ Real-time entity extraction API
- ✅ DuckDB database with MCP integration
- ✅ Production-ready Node.js application
- ✅ Auto-scaling and health monitoring

**Next Steps:**
1. Share your live demo URL
2. Test with real voice recordings
3. Monitor usage in Koyeb dashboard
4. Consider adding custom domain
5. Scale up instance size if needed

**Need help?** Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions or create an issue in your repository. 