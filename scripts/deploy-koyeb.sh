#!/bin/bash

# Koyeb Deployment Script for Mastra Voice Entity Extraction

set -e

echo "🚀 Deploying Mastra Voice Entity Extraction to Koyeb..."

# Check if required environment variables are set
if [ -z "$KOYEB_API_TOKEN" ]; then
    echo "❌ KOYEB_API_TOKEN environment variable is required"
    echo "   Get your token from: https://app.koyeb.com/account/api"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY environment variable is required"
    echo "   Get your key from: https://platform.openai.com/api-keys"
    exit 1
fi

# Get GitHub repository info
REPO_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REPO_URL" ]; then
    echo "❌ No git remote origin found. Please push to GitHub first."
    exit 1
fi

# Extract GitHub repository name
GITHUB_REPO=$(echo $REPO_URL | sed 's/.*github\.com[\/:]//g' | sed 's/\.git$//g')
echo "📋 GitHub Repository: $GITHUB_REPO"

# Check if Koyeb CLI is installed
if ! command -v koyeb &> /dev/null; then
    echo "📦 Installing Koyeb CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install koyeb/tap/koyeb
    else
        echo "Please install Koyeb CLI: https://github.com/koyeb/koyeb-cli"
        exit 1
    fi
fi

# Login to Koyeb
echo "🔐 Logging in to Koyeb..."
echo $KOYEB_API_TOKEN | koyeb auth login --token

# Check if app already exists
APP_NAME="mastra-voice-entity-extraction"
if koyeb app get $APP_NAME &>/dev/null; then
    echo "🔄 Updating existing app: $APP_NAME"
    UPDATE_MODE=true
else
    echo "🆕 Creating new app: $APP_NAME"
    UPDATE_MODE=false
fi

# Create or update the app
if [ "$UPDATE_MODE" = false ]; then
    echo "🏗️  Creating Koyeb app..."
    koyeb app init $APP_NAME
fi

# Deploy the service
echo "🚀 Deploying service..."
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
    --env DB_PATH=/tmp/entities.db \
    --env OPENAI_API_KEY=$OPENAI_API_KEY \
    --health-check-http-path /api/health \
    --health-check-http-port 3000 \
    --scale-min 1 \
    --scale-max 3 \
    --replace

echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get deployment status
echo "📊 Deployment Status:"
koyeb service get web --app $APP_NAME

# Get the deployed URL
DEPLOYED_URL=$(koyeb service get web --app $APP_NAME --output json | jq -r '.public_domain_names[0]' 2>/dev/null || echo "")

if [ "$DEPLOYED_URL" != "null" ] && [ -n "$DEPLOYED_URL" ]; then
    echo ""
    echo "🎉 Deployment Successful!"
    echo "🌐 Your app is live at: https://$DEPLOYED_URL"
    echo ""
    echo "📋 Available endpoints:"
    echo "   • Web Interface: https://$DEPLOYED_URL"
    echo "   • Health Check:  https://$DEPLOYED_URL/api/health"
    echo "   • API Docs:      https://$DEPLOYED_URL/api"
    echo ""
    echo "🔍 Monitor your deployment:"
    echo "   • Koyeb Dashboard: https://app.koyeb.com/apps/$APP_NAME"
    echo "   • Logs: koyeb service logs web --app $APP_NAME"
    echo ""
else
    echo "⚠️  Deployment may still be in progress"
    echo "🔍 Check status: koyeb service get web --app $APP_NAME"
    echo "📊 View logs: koyeb service logs web --app $APP_NAME"
fi

echo "✅ Deployment script completed!" 