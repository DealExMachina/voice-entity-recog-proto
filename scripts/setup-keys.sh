#!/bin/bash

# Mastra Voice Entity Extraction - Quick API Key Setup
# This script helps you set up your environment variables

set -e

echo "🔑 Mastra Voice Entity Extraction - API Key Setup"
echo "=================================================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Edit .env manually if needed."
        exit 1
    fi
fi

# Copy template
echo "📋 Creating .env file from template..."
cp .env.example .env

echo "✅ .env file created!"
echo ""

# Prompt for API keys
echo "🤖 Let's set up your AI providers:"
echo ""

# OpenAI setup
echo "🔵 OpenAI Configuration (Recommended for production)"
echo "   Get your key from: https://platform.openai.com/api-keys"
read -p "Enter your OpenAI API key (or press Enter to skip): " openai_key

if [ ! -z "$openai_key" ]; then
    if [[ $openai_key == sk-* ]]; then
        sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" .env
        echo "✅ OpenAI key configured"
    else
        echo "⚠️  Warning: OpenAI keys usually start with 'sk-'. Added anyway."
        sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" .env
    fi
else
    echo "⏭️  Skipped OpenAI configuration"
fi

echo ""

# Mistral setup
echo "🟣 Mistral AI Configuration (Cost-effective alternative)"
echo "   Get your key from: https://console.mistral.ai/"
read -p "Enter your Mistral API key (or press Enter to skip): " mistral_key

if [ ! -z "$mistral_key" ]; then
    sed -i.bak "s/MISTRAL_API_KEY=.*/MISTRAL_API_KEY=$mistral_key/" .env
    echo "✅ Mistral key configured"
else
    echo "⏭️  Skipped Mistral configuration"
fi

echo ""

# Provider selection
if [ ! -z "$openai_key" ] && [ ! -z "$mistral_key" ]; then
    echo "🎯 Choose your default AI provider:"
    echo "1) OpenAI (Recommended - supports transcription + entity extraction)"
    echo "2) Mistral (Cost-effective - entity extraction only)"
    echo "3) Demo (No API calls - pattern matching only)"
    read -p "Choose (1-3): " -n 1 -r provider_choice
    echo ""
    
    case $provider_choice in
        1) sed -i.bak "s/AI_PROVIDER=.*/AI_PROVIDER=openai/" .env ;;
        2) sed -i.bak "s/AI_PROVIDER=.*/AI_PROVIDER=mistral/" .env ;;
        3) sed -i.bak "s/AI_PROVIDER=.*/AI_PROVIDER=demo/" .env ;;
        *) echo "Invalid choice, keeping demo mode" ;;
    esac
elif [ ! -z "$openai_key" ]; then
    sed -i.bak "s/AI_PROVIDER=.*/AI_PROVIDER=openai/" .env
    echo "🎯 Set default provider to OpenAI"
elif [ ! -z "$mistral_key" ]; then
    sed -i.bak "s/AI_PROVIDER=.*/AI_PROVIDER=mistral/" .env
    echo "🎯 Set default provider to Mistral"
else
    echo "🎯 No API keys provided - using demo mode"
fi

# Rate limiting setup
echo ""
echo "🛡️  Rate Limiting Configuration:"
read -p "Enable rate limiting? (Y/n): " -n 1 -r rate_limit
echo ""

if [[ $rate_limit =~ ^[Nn]$ ]]; then
    sed -i.bak "s/RATE_LIMIT_ENABLED=.*/RATE_LIMIT_ENABLED=false/" .env
    echo "🔓 Rate limiting disabled"
else
    sed -i.bak "s/RATE_LIMIT_ENABLED=.*/RATE_LIMIT_ENABLED=true/" .env
    echo "🔒 Rate limiting enabled (recommended)"
fi

# Clean up backup file
rm -f .env.bak

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Configuration summary:"
echo "========================="
cat .env | grep -E "^(OPENAI_API_KEY|MISTRAL_API_KEY|AI_PROVIDER|RATE_LIMIT_ENABLED)=" | while IFS= read -r line; do
    key=$(echo "$line" | cut -d'=' -f1)
    value=$(echo "$line" | cut -d'=' -f2)
    
    if [[ $key == *"API_KEY"* ]]; then
        if [ ! -z "$value" ] && [[ $value != *"your"* ]]; then
            echo "$key=SET (${#value} characters)"
        else
            echo "$key=NOT SET"
        fi
    else
        echo "$line"
    fi
done

echo ""
echo "🚀 Ready to start! Run:"
echo "   npm run dev"
echo ""
echo "🔧 To change settings later:"
echo "   - Edit .env file manually"
echo "   - Or run this script again: ./scripts/setup-keys.sh"
echo ""
echo "📚 For more information:"
echo "   - Read docs/security/KEY_MANAGEMENT.md"
echo "   - Read docs/guides/CONFIGURATION.md"
echo ""
echo "⚠️  Remember: Never commit .env to git!" 