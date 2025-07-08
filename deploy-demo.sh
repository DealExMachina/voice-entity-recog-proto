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
        if command -v brew &> /dev/null; then
            brew install koyeb/tap/koyeb
        else
            echo "Please install Homebrew first: https://brew.sh"
            echo "Or install Koyeb CLI manually: https://github.com/koyeb/koyeb-cli"
            exit 1
        fi
    else
        echo "Please install Koyeb CLI: https://github.com/koyeb/koyeb-cli"
        exit 1
    fi
fi

# Check for Koyeb token
if [ -z "$KOYEB_API_TOKEN" ] && [ -z "$KOYEB_TOKEN" ]; then
    echo "⚠️  KOYEB_API_TOKEN or KOYEB_TOKEN not set."
    echo "📋 Get your token from: https://app.koyeb.com/account/api"
    echo "💡 Then run: export KOYEB_TOKEN=your_token_here"
    echo ""
    echo "🚀 Alternative: Deploy via Koyeb Dashboard"
    echo "   1. Go to: https://app.koyeb.com"
    echo "   2. Connect GitHub: DealExMachina/voice-entity-recog-proto"
    echo "   3. Use these settings:"
    echo "      • Build command: npm ci && npm run build:production"
    echo "      • Run command: npm start"
    echo "      • Port: 3000"
    echo "      • Environment: AI_PROVIDER=demo"
    echo "      • Health check: /api/health"
    exit 1
fi

# Use whichever token is available
TOKEN="${KOYEB_TOKEN:-$KOYEB_API_TOKEN}"

# Get GitHub repository
GITHUB_REPO="DealExMachina/voice-entity-recog-proto"
APP_NAME="voice-entity-demo"

echo "📋 Repository: github.com/$GITHUB_REPO"
echo "🏷️  App Name: $APP_NAME"

# Login to Koyeb
echo "🔐 Authenticating with Koyeb..."
echo $TOKEN | koyeb auth login --token

# Test authentication
if ! koyeb auth current-user > /dev/null 2>&1; then
    echo "❌ Authentication failed. Please check your token."
    exit 1
fi

# Create app if it doesn't exist
if ! koyeb apps list --output json | jq -e ".apps[] | select(.name == \"$APP_NAME\")" > /dev/null 2>&1; then
    echo "🆕 Creating Koyeb app: $APP_NAME"
    koyeb apps create $APP_NAME
else
    echo "📱 Using existing app: $APP_NAME"
fi

# Check if service exists and delete it for clean deployment
if koyeb services list --app $APP_NAME --output json | jq -e '.services[] | select(.name == "web")' > /dev/null 2>&1; then
    echo "🔄 Removing existing service for clean deployment..."
    koyeb services delete web --app $APP_NAME || true
    echo "⏳ Waiting for service deletion..."
    sleep 10
fi

# Deploy in demo mode
echo "🚀 Deploying demo service..."
koyeb services create web \
    --app $APP_NAME \
    --git github.com/$GITHUB_REPO \
    --git-branch main \
    --git-build-command "npm ci && npm run build:production" \
    --git-run-command "npm start" \
    --port 3000:http \
    --instance-type nano \
    --region fra \
    --env NODE_ENV=production \
    --env PORT=3000 \
    --env AI_PROVIDER=demo \
    --env DB_PATH=/tmp/entities.db \
    --env RATE_LIMIT_ENABLED=true \
    --health-checks "http(path=/api/health,port=3000)" \
    --scale 1

echo "⏳ Waiting for deployment..."
sleep 30

# Check deployment status
echo "📊 Checking deployment status..."
koyeb services get web --app $APP_NAME

# Get service URL
echo "🔍 Getting service URL..."
SERVICE_URL=$(koyeb services get web --app $APP_NAME --output json | jq -r '.urls[0]' 2>/dev/null || echo "")

echo ""
echo "🎉 Demo Deployment Complete!"
echo "=============================================="
if [ -n "$SERVICE_URL" ] && [ "$SERVICE_URL" != "null" ]; then
    echo "🌐 Your demo app is available at:"
    echo "   $SERVICE_URL"
    echo ""
    echo "🔍 Test endpoints:"
    echo "   • Health: $SERVICE_URL/api/health"
    echo "   • Status: $SERVICE_URL/api/ai/status"
else
    echo "🌐 Your demo app will be available shortly at:"
    echo "   https://$APP_NAME.koyeb.app"
fi
echo ""
echo "✨ Demo Features Available:"
echo "   • Voice entity extraction (demo mode)"
echo "   • Real-time web interface"
echo "   • Multi-provider switching UI"
echo "   • Rate limiting demonstration"
echo ""
echo "🔍 Monitor deployment:"
echo "   • Dashboard: https://app.koyeb.com/apps/$APP_NAME"
echo "   • Logs: koyeb services logs web --app $APP_NAME"
echo ""
echo "🚀 To enable AI providers later:"
echo "   • Add OPENAI_API_KEY environment variable"
echo "   • Add MISTRAL_API_KEY environment variable"
echo "   • Set AI_PROVIDER=openai or AI_PROVIDER=mistral" 