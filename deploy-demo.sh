#!/bin/bash

# Quick Demo Deployment to Koyeb - No API Keys Required!
# This deploys the app in demo mode for showcase purposes

set -e

echo "🎯 Quick Demo Deployment to Koyeb (Demo Mode)"
echo "=============================================="

# Check if Koyeb CLI is available
if ! command -v koyeb &> /dev/null; then
    echo "❌ Koyeb CLI not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install koyeb/tap/koyeb
    else
        echo "Please install Koyeb CLI: https://github.com/koyeb/koyeb-cli"
        exit 1
    fi
fi

# Check for Koyeb token
if [ -z "$KOYEB_API_TOKEN" ]; then
    echo "⚠️  KOYEB_API_TOKEN not set."
    echo "📋 Get your token from: https://app.koyeb.com/account/api"
    echo "💡 Then run: export KOYEB_API_TOKEN=your_token_here"
    echo ""
    echo "🚀 Alternative: Deploy via Koyeb Dashboard"
    echo "   1. Go to: https://app.koyeb.com"
    echo "   2. Connect GitHub: DealExMachina/voice-entity-recog-proto"
    echo "   3. Use these settings:"
    echo "      • Build command: npm ci"
    echo "      • Run command: npm start"
    echo "      • Port: 3000"
    echo "      • Environment: AI_PROVIDER=demo"
    exit 1
fi

# Get GitHub repository
GITHUB_REPO="DealExMachina/voice-entity-recog-proto"
APP_NAME="voice-entity-demo"

echo "📋 Repository: github.com/$GITHUB_REPO"
echo "🏷️  App Name: $APP_NAME"

# Login to Koyeb
echo "🔐 Authenticating with Koyeb..."
echo $KOYEB_API_TOKEN | koyeb auth login --token

# Check if app exists
if koyeb app get $APP_NAME &>/dev/null; then
    echo "🔄 Updating existing demo app..."
    koyeb service delete web --app $APP_NAME || true
    sleep 5
fi

# Create/update app
echo "🏗️  Creating demo app..."
koyeb app init $APP_NAME || true

# Deploy in demo mode
echo "🚀 Deploying demo service..."
koyeb service create web \
    --app $APP_NAME \
    --git github.com/$GITHUB_REPO \
    --git-branch main \
    --git-build-command "npm ci" \
    --git-run-command "npm start" \
    --port 3000:http \
    --instance-type nano \
    --region fra \
    --env NODE_ENV=production \
    --env PORT=3000 \
    --env AI_PROVIDER=demo \
    --env DB_PATH=/tmp/entities.db \
    --env RATE_LIMIT_ENABLED=true \
    --health-check-http-path /api/health \
    --health-check-http-port 3000 \
    --scale-min 1 \
    --scale-max 2

echo "⏳ Waiting for deployment..."
sleep 30

# Check deployment status
echo "📊 Checking deployment status..."
koyeb service get web --app $APP_NAME

echo ""
echo "🎉 Demo Deployment Complete!"
echo "=============================================="
echo "🌐 Your demo app will be available shortly at:"
echo "   https://$APP_NAME.koyeb.app"
echo ""
echo "✨ Demo Features Available:"
echo "   • Voice entity extraction (demo mode)"
echo "   • Real-time web interface"
echo "   • Multi-provider switching UI"
echo "   • Rate limiting demonstration"
echo ""
echo "🔍 Monitor deployment:"
echo "   • Dashboard: https://app.koyeb.com/apps/$APP_NAME"
echo "   • Logs: koyeb service logs web --app $APP_NAME"
echo ""
echo "🚀 To enable AI providers later:"
echo "   • Add OPENAI_API_KEY environment variable"
echo "   • Add MISTRAL_API_KEY environment variable"
echo "   • Set AI_PROVIDER=openai or AI_PROVIDER=mistral" 