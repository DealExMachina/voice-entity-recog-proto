# Mastra Voice Entity Extraction

A sophisticated AI-powered entity extraction prototype that processes voice input, text, and audio files to identify and store entities using DuckDB via the Model Context Protocol (MCP). Features multiple AI providers, rate limiting, and a modern web interface.

## 🌟 Features

### Core Functionality
- **Multi-modal Input**: Voice recording, file upload, and direct text input
- **AI-Powered Processing**: Entity extraction using OpenAI GPT-4o-mini or Mistral AI
- **Real-time Communication**: WebSocket integration for live updates
- **Database Storage**: DuckDB with optimized schema and MCP integration
- **Modern UI**: Sophisticated glass morphism design with Tailwind CSS

### AI Provider Management
- **Multiple Providers**: OpenAI, Mistral AI, and Demo mode
- **Dynamic Switching**: Switch between AI providers on-demand via web interface
- **Fallback Support**: Automatic fallback to demo mode when providers unavailable
- **Cost-Effective Models**: Uses efficient models (GPT-4o-mini, Mistral-small)

### Rate Limiting & Security
- **Intelligent Rate Limiting**: Different limits for different endpoints
  - AI operations: 50 requests per 15 minutes
  - File uploads: 20 requests per 15 minutes
  - General API: 200 requests per 15 minutes
  - Health checks: 1000 requests per 15 minutes
- **Configurable Limits**: Environment variable configuration
- **Error Handling**: Graceful degradation with informative error messages

### Entity Types Supported
- 👤 **Person**: People's names
- 🏢 **Organization**: Companies, departments, teams
- 📍 **Location**: Places, addresses, cities, countries
- 📅 **Event**: Meetings, appointments, deadlines
- 📦 **Product**: Items, services, features
- 💰 **Financial**: Money amounts, budgets, costs
- 📞 **Contact**: Email addresses, phone numbers
- 📆 **Date**: Dates and date ranges
- ⏰ **Time**: Times and time ranges

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Optional: OpenAI API key
- Optional: Mistral AI API key

### Installation

1. **Clone and setup**:
```bash
git clone <repository-url>
cd sales-buddy
npm install
```

2. **Configure environment**:
```bash
# Option 1: Interactive setup (recommended)
./scripts/setup-keys.sh

# Option 2: Manual setup
cp .env.example .env
# Edit .env with your API keys
```

3. **Start the application**:
```bash
npm run dev
```

4. **Open in browser**: http://localhost:3000

## 🔧 Configuration

See [Configuration Guide](docs/guides/CONFIGURATION.md) for detailed configuration options.

### Quick Configuration

```bash
# Demo mode (no API keys needed)
AI_PROVIDER=demo
RATE_LIMIT_ENABLED=false

# OpenAI production setup
OPENAI_API_KEY=sk-your-key
AI_PROVIDER=openai
RATE_LIMIT_ENABLED=true

# Mistral cost-effective setup
MISTRAL_API_KEY=your-key
AI_PROVIDER=mistral
RATE_LIMIT_ENABLED=true
```

## 🎯 Usage

### Web Interface

1. **AI Provider Selection**: Use the dropdown in the top-right to switch between available providers
2. **Voice Recording**: Click the microphone button to start/stop recording
3. **File Upload**: Upload audio files for transcription and entity extraction
4. **Text Input**: Enter text directly for entity extraction
5. **Real-time Results**: View extracted entities with confidence scores and context

### API Endpoints

```bash
# Health check
GET /api/health

# AI provider management
GET /api/ai/status
POST /api/ai/provider {"provider": "openai|mistral|demo"}
GET /api/ai/providers

# Entity extraction
POST /api/extract-entities {"text": "your text"}
POST /api/process-audio (FormData with audio file)

# Database operations
GET /api/entities?type=person&limit=50
POST /api/entities {"type": "person", "value": "John Doe"}
GET /api/stats
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Express API    │    │   AI Providers  │
│                 │◄──►│                  │◄──►│                 │
│ • Voice Input   │    │ • Rate Limiting  │    │ • OpenAI        │
│ • File Upload   │    │ • WebSocket      │    │ • Mistral AI    │
│ • Text Input    │    │ • REST Routes    │    │ • Demo Mode     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   MCP Service    │
                       │                  │
                       │ • Entity Storage │
                       │ • Conversations  │
                       │ • Relationships  │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │     DuckDB       │
                       │                  │
                       │ • High Performance│
                       │ • Analytics Ready│
                       │ • Local Storage  │
                       └──────────────────┘
```

### Core Components

- **MastraAgent** (`src/agents/mastra-agent.js`): Multi-provider AI processing
- **McpService** (`src/services/mcp-service.js`): MCP-compliant database operations
- **Rate Limiting** (`src/middleware/rateLimiter.js`): Configurable request throttling
- **Database Layer** (`src/database/duckdb.js`): Optimized DuckDB integration
- **Web Interface** (`public/`): Modern responsive UI with real-time updates

## 🚀 Deployment

### Quick Deploy to Koyeb (EU Frankfurt)

```bash
# Method 1: Dashboard (Recommended)
# 1. Push code to GitHub
# 2. Connect repository to Koyeb
# 3. Add environment variables
# 4. Deploy automatically

# Method 2: CLI
./scripts/deploy-koyeb.sh
```

See [Deployment Documentation](docs/deployment/) for detailed deployment guides.

## 📊 Development

### Available Scripts

```bash
npm run dev          # Development server with hot reload
npm run start        # Production server
npm test             # Run tests
npm run health       # Test health endpoint
./scripts/setup-keys.sh     # Interactive API key setup
./scripts/check-config.sh   # Verify configuration
```

### Development Tools

- **Configuration Checker**: `./scripts/check-config.sh`
- **API Key Setup**: `./scripts/setup-keys.sh`
- **Health Check**: `npm run health`
- **Live Reload**: Automatic restart on file changes

## 🔒 Security Features

- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Multi-tier protection against abuse
- **Error Handling**: Secure error responses without sensitive data
- **CORS Protection**: Configurable cross-origin resource sharing
- **File Upload Safety**: Type validation and size limits
- **Environment Isolation**: Separate configurations for dev/staging/production

## 🧪 Testing

```bash
# Run basic tests
npm test

# Test health endpoint
npm run health

# Test configuration
./scripts/check-config.sh

# Manual API testing
curl -X POST http://localhost:3000/api/extract-entities \
  -H "Content-Type: application/json" \
  -d '{"text": "Schedule meeting with Alice at Google tomorrow 2 PM"}'
```

## 📚 Documentation

### Quick Reference
- [API Key Summary](API_KEY_SUMMARY.md) - **Start here for key management**

### Security & Configuration
- [Key Management Guide](docs/security/KEY_MANAGEMENT.md) - Detailed security practices
- [DevOps Security](docs/security/DEVOPS_SECURITY.md) - Production deployment security
- [Configuration Guide](docs/guides/CONFIGURATION.md) - All settings explained

### Development Guides
- [Getting Started](docs/guides/GETTING_STARTED.md) - Development setup
- [Project Summary](docs/guides/PROJECT_SUMMARY.md) - Technical overview
- [API Documentation](docs/API.md) - Complete API reference
- [Architecture Overview](docs/ARCHITECTURE.md) - System design

### Deployment Guides
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Complete deployment instructions
- [Quick Deploy](docs/deployment/QUICK_DEPLOY.md) - 10-minute deployment
- [EU Deployment](docs/deployment/DEPLOY_EU.md) - Frankfurt region deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the [documentation](docs/) first
2. Review existing GitHub issues
3. Create a new issue with detailed information
4. Use the configuration checker: `./scripts/check-config.sh`

---

**Built with** ❤️ **for the Mastra community** 