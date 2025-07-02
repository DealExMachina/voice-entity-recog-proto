# Sales Buddy - AI Voice Entity Extraction

A sophisticated AI-powered entity extraction system that processes voice input, text, and audio files to identify and store entities using DuckDB via the Model Context Protocol (MCP).

## 🌟 Features

- **Multi-modal Input**: Voice recording, file upload, and direct text input
- **AI-Powered Processing**: Entity extraction using OpenAI GPT-4o-mini or Mistral AI  
- **Real-time Communication**: WebSocket integration for live updates
- **Database Storage**: DuckDB with optimized schema and MCP integration
- **Modern UI**: Glass morphism design with Tailwind CSS and production optimization
- **Multiple AI Providers**: OpenAI, Mistral AI, and Demo mode with runtime switching
- **Production Ready**: Docker containerization, CI/CD, and Koyeb deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Optional: OpenAI API key for full functionality

### Installation

```bash
# Clone and install
git clone <repository-url>
cd sales-buddy
npm install

# Setup environment (interactive)
./scripts/setup-keys.sh

# Start development
npm run dev
```

Open http://localhost:3000

### Docker Deployment

```bash
# Local Docker
cp docker.env.example docker.env
# Edit docker.env with your API keys
docker-compose up
```

## 🎯 Usage

### Web Interface
1. **AI Provider Selection**: Dropdown in top-right to switch providers
2. **Voice Recording**: Click microphone to start/stop recording  
3. **File Upload**: Upload audio files for transcription
4. **Text Input**: Enter text directly for entity extraction
5. **Real-time Results**: View extracted entities with confidence scores

### API Endpoints

```bash
# Health check
GET /api/health

# Entity extraction  
POST /api/extract-entities {"text": "Meeting with John at Acme Corp tomorrow"}

# Provider management
GET /api/ai/status
POST /api/ai/provider {"provider": "openai|mistral|demo"}

# Database operations
GET /api/entities?type=person&limit=50
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
                       │ • Type Safety    │
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

## 🚀 Deployment

### Automated Deployment (Recommended)

**GitHub Actions + Koyeb:**
1. Set repository secrets: `KOYEB_TOKEN`, `OPENAI_API_KEY`  
2. Push to main branch → automatic deployment
3. Production-optimized Docker build with minified assets

### Manual Deployment Options

**Koyeb CLI:**
```bash
# Set environment variables
export KOYEB_TOKEN=your-token
export OPENAI_API_KEY=sk-your-key

# Deploy demo mode (no API keys needed)
./deploy-demo.sh
```

**Local Docker:**
```bash
# Production build
docker build -t sales-buddy .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-your-key sales-buddy
```

## 📚 Documentation

### Quick Reference
- [API Providers Guide](docs/guides/API_PROVIDERS.md) - AI provider configuration
- [API Key Management](docs/security/API_KEY_MANAGEMENT.md) - Secure key handling
- [Getting Started](docs/guides/GETTING_STARTED.md) - Development setup

### Complete Documentation
- [Architecture Overview](docs/ARCHITECTURE.md) - System design
- [API Documentation](docs/API.md) - Complete API reference  
- [Configuration Guide](docs/guides/CONFIGURATION.md) - All settings
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Production deployment
- [Security Guide](docs/security/DEVOPS_SECURITY.md) - Production security

## 🧪 Testing

```bash
# Run tests
npm test

# Health check
npm run health

# Configuration validation
./scripts/check-config.sh
```

## 🛠️ Development

### Build Commands
```bash
npm run build              # Production build
npm run build:production   # Production with asset optimization  
npm run dev               # Development with hot reload
npm run type-check        # TypeScript validation
```

### Key Technologies
- **Backend**: TypeScript, Express.js, DuckDB, WebSocket
- **Frontend**: Vanilla JS, Tailwind CSS (production optimized)
- **AI**: OpenAI GPT-4o-mini, Whisper, Mistral AI
- **Deployment**: Docker, GitHub Actions, Koyeb
- **Database**: DuckDB with MCP protocol

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Configuration Issues**: `./scripts/check-config.sh`
- **API Problems**: Check [API Providers Guide](docs/guides/API_PROVIDERS.md)
- **Deployment Issues**: See [Deployment Guide](docs/deployment/DEPLOYMENT.md)
- **Security Concerns**: Review [Security Guide](docs/security/DEVOPS_SECURITY.md) 