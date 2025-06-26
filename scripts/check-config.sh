#!/bin/bash

# Mastra Voice Entity Extraction - Configuration Checker
# This script checks your current configuration and environment

echo "🔍 Mastra Configuration Checker"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "   Run: ./setup-keys.sh to create one"
    echo "   Or:  cp .env.example .env"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Load environment
set -a
source .env
set +a

echo "📋 Current Configuration:"
echo "========================="

# Check API keys
echo "🔑 API Keys:"
if [ ! -z "$OPENAI_API_KEY" ] && [[ $OPENAI_API_KEY != *"your"* ]]; then
    echo "   OpenAI: ✅ SET (${#OPENAI_API_KEY} characters)"
else
    echo "   OpenAI: ❌ NOT SET"
fi

if [ ! -z "$MISTRAL_API_KEY" ] && [[ $MISTRAL_API_KEY != *"your"* ]]; then
    echo "   Mistral: ✅ SET (${#MISTRAL_API_KEY} characters)"
else
    echo "   Mistral: ❌ NOT SET"
fi

echo ""

# Check provider configuration
echo "🤖 AI Provider: $AI_PROVIDER"
case $AI_PROVIDER in
    "openai")
        if [ ! -z "$OPENAI_API_KEY" ] && [[ $OPENAI_API_KEY != *"your"* ]]; then
            echo "   Status: ✅ OpenAI configured correctly"
        else
            echo "   Status: ❌ OpenAI selected but no API key provided"
        fi
        ;;
    "mistral")
        if [ ! -z "$MISTRAL_API_KEY" ] && [[ $MISTRAL_API_KEY != *"your"* ]]; then
            echo "   Status: ✅ Mistral configured correctly"
        else
            echo "   Status: ❌ Mistral selected but no API key provided"
        fi
        ;;
    "demo")
        echo "   Status: ✅ Demo mode (no API keys needed)"
        ;;
    *)
        echo "   Status: ⚠️  Unknown provider: $AI_PROVIDER"
        ;;
esac

echo ""

# Check rate limiting
echo "🛡️  Rate Limiting: ${RATE_LIMIT_ENABLED:-true}"
if [ "$RATE_LIMIT_ENABLED" = "false" ]; then
    echo "   ⚠️  Rate limiting is disabled"
else
    echo "   Max requests: ${RATE_LIMIT_MAX_REQUESTS:-100} per ${RATE_LIMIT_WINDOW_MINUTES:-15} minutes"
fi

echo ""

# Check server configuration
echo "🖥️  Server Configuration:"
echo "   Port: ${PORT:-3000}"
echo "   Environment: ${NODE_ENV:-development}"
echo "   Database: ${DB_PATH:-./data/entities.db}"

echo ""

# Test if server is running
echo "🌐 Server Status:"
if curl -s http://localhost:${PORT:-3000}/api/health > /dev/null 2>&1; then
    echo "   ✅ Server is running at http://localhost:${PORT:-3000}"
    
    # Test AI endpoints
    echo ""
    echo "🧪 API Tests:"
    
    # Check AI status
    ai_status=$(curl -s http://localhost:${PORT:-3000}/api/ai/status)
    if [ $? -eq 0 ]; then
        echo "   ✅ AI status endpoint working"
        echo "   Current provider: $(echo $ai_status | grep -o '"current":"[^"]*"' | cut -d'"' -f4)"
        available=$(echo $ai_status | grep -o '"available":\[[^]]*\]' | sed 's/.*\[\(.*\)\].*/\1/' | tr -d '"')
        echo "   Available providers: $available"
    else
        echo "   ❌ AI status endpoint failed"
    fi
    
    # Test entity extraction
    echo ""
    echo "   Testing entity extraction..."
    test_result=$(curl -s -X POST http://localhost:${PORT:-3000}/api/extract-entities \
        -H "Content-Type: application/json" \
        -d '{"text": "Test with John Doe from Google"}' 2>/dev/null)
    
    if echo "$test_result" | grep -q '"success":true'; then
        entity_count=$(echo "$test_result" | grep -o '"entities":\[[^]]*\]' | grep -o '},{' | wc -l)
        entity_count=$((entity_count + 1))
        echo "   ✅ Entity extraction working (found $entity_count entities)"
    else
        echo "   ❌ Entity extraction failed"
    fi
    
else
    echo "   ❌ Server not running"
    echo "   Start with: npm run dev"
fi

echo ""

# Security check
echo "🔒 Security Check:"
if git check-ignore .env > /dev/null 2>&1; then
    echo "   ✅ .env is properly ignored by git"
else
    echo "   ⚠️  .env might not be ignored by git!"
    echo "      Add '.env' to .gitignore"
fi

# Check for common issues
echo ""
echo "🔧 Recommendations:"

# No API keys
if [ -z "$OPENAI_API_KEY" ] && [ -z "$MISTRAL_API_KEY" ]; then
    echo "   📝 Consider adding API keys for better functionality"
    echo "      - OpenAI: https://platform.openai.com/api-keys"
    echo "      - Mistral: https://console.mistral.ai/"
fi

# Rate limiting in dev
if [ "$NODE_ENV" = "development" ] && [ "$RATE_LIMIT_ENABLED" != "false" ]; then
    echo "   🚧 Consider disabling rate limiting for development:"
    echo "      Add RATE_LIMIT_ENABLED=false to .env"
fi

# Production checks
if [ "$NODE_ENV" = "production" ]; then
    if [ "$RATE_LIMIT_ENABLED" = "false" ]; then
        echo "   ⚠️  Enable rate limiting for production!"
    fi
    if [ "$AI_PROVIDER" = "demo" ]; then
        echo "   ⚠️  Using demo mode in production - consider real AI provider"
    fi
fi

echo ""
echo "✨ Configuration check complete!"
echo ""
echo "📚 For more help:"
echo "   - ./setup-keys.sh    (Setup API keys)"
echo "   - KEY_MANAGEMENT.md  (Key management guide)"
echo "   - CONFIGURATION.md   (Configuration guide)" 