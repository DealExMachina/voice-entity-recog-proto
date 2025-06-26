# Project Overview

## 📋 Repository Structure

```
sales-buddy/
├── 📄 README.md                 # Main project documentation
├── 📄 API_KEY_SUMMARY.md        # Quick key management reference
├── 📄 OVERVIEW.md               # This file - project overview
├── 📄 .env.example              # Environment template
├── 📄 package.json              # Dependencies and scripts
├── 📄 Dockerfile                # Container configuration
├── 📄 koyeb.yaml               # Deployment configuration
│
├── 📁 src/                      # Application source code
│   ├── 📄 index.js              # Main server entry point
│   ├── 📁 agents/               # AI processing agents
│   ├── 📁 database/             # Database integration
│   ├── 📁 middleware/           # Express middleware (rate limiting)
│   ├── 📁 routes/               # API route handlers
│   └── 📁 services/             # Business logic services
│
├── 📁 public/                   # Web interface
│   ├── 📄 index.html            # Main web application
│   └── 📄 app.js                # Frontend JavaScript
│
├── 📁 scripts/                  # Utility scripts
│   ├── 📄 setup-keys.sh         # Interactive API key setup
│   ├── 📄 check-config.sh       # Configuration verification
│   ├── 📄 deploy-koyeb.sh       # Deployment script
│   └── 📄 setup.sh              # Legacy setup script
│
├── 📁 docs/                     # Documentation
│   ├── 📄 INDEX.md              # Documentation navigation
│   ├── 📄 API.md                # API reference
│   ├── 📄 ARCHITECTURE.md       # System architecture
│   ├── 📁 guides/               # Setup and development guides
│   ├── 📁 security/             # Security and key management
│   └── 📁 deployment/           # Deployment guides
│
├── 📁 tests/                    # Test files
├── 📁 examples/                 # Sample data and demos
├── 📁 data/                     # Database files (gitignored)
├── 📁 deploy/                   # Deployment configurations
└── 📁 .github/                  # GitHub Actions workflows
```

## 🎯 Project Goals

**Primary Goal**: Demonstrate Mastra framework capabilities for real-time entity extraction from voice input with secure, production-ready deployment.

**Key Features**:
- Multi-modal input (voice, file, text)
- Multiple AI providers (OpenAI, Mistral, Demo)
- Real-time processing and display
- Secure API key management
- Production deployment ready
- Rate limiting and security

## 🔧 Technology Stack

### Backend
- **Runtime**: Node.js 18+ with ES modules
- **Framework**: Express.js with WebSocket support
- **Database**: DuckDB (high-performance analytics)
- **AI Providers**: OpenAI (GPT-4o-mini, Whisper), Mistral AI
- **Protocol**: Model Context Protocol (MCP)

### Frontend
- **Framework**: Vanilla JavaScript with modern APIs
- **Styling**: Tailwind CSS with glass morphism design
- **Icons**: Lucide icons
- **Features**: WebSocket real-time updates, Web Audio API

### Infrastructure
- **Deployment**: Koyeb (EU Frankfurt region)
- **CI/CD**: GitHub Actions
- **Security**: Rate limiting, environment isolation
- **Monitoring**: Health checks, usage tracking

## 🚀 Quick Start Guide

### 1. Clone and Install
```bash
git clone <repository-url>
cd sales-buddy
npm install
```

### 2. Configure Environment
```bash
# Interactive setup (recommended)
./scripts/setup-keys.sh

# Manual setup
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Verify Setup
```bash
./scripts/check-config.sh
npm run health
```

## 🔐 Security Features

### API Key Management
- **Local Development**: `.env` files (never committed)
- **Production**: Cloud platform environment variables
- **CI/CD**: GitHub Secrets with environment protection
- **Rotation**: Documented procedures and emergency protocols

### Rate Limiting
- **AI Endpoints**: 50 requests/15 minutes (expensive operations)
- **File Uploads**: 20 requests/15 minutes (resource intensive)
- **General API**: 200 requests/15 minutes (standard operations)
- **Health Checks**: 1000 requests/15 minutes (monitoring)

### Environment Isolation
- **Development**: Demo mode, relaxed limits, debug logging
- **Staging**: Real AI providers, moderate limits, testing
- **Production**: Optimized providers, strict limits, secure logging

## 🏗️ Architecture Overview

### Request Flow
```
User Input → Web Interface → Express API → Rate Limiter → AI Provider
                                     ↓
Database ← MCP Service ← Entity Processor ← AI Response
```

### Component Breakdown
- **MastraAgent**: Coordinates AI providers and processing
- **McpService**: Implements Model Context Protocol for database operations
- **Rate Limiter**: Protects against abuse with configurable limits
- **Database Layer**: DuckDB with optimized schema for analytics
- **Web Interface**: Real-time UI with WebSocket communication

## 📊 Development Workflow

### Daily Development
```bash
npm run dev          # Start with hot reload
npm run health       # Check if everything works
npm run config       # Verify configuration
npm test             # Run tests
```

### Adding Features
1. Implement in `src/` directory
2. Add tests in `tests/`
3. Update documentation
4. Test with `./scripts/check-config.sh`
5. Deploy with `npm run deploy`

### Configuration Changes
1. Update `.env.example`
2. Update `docs/guides/CONFIGURATION.md`
3. Test with `./scripts/setup-keys.sh`
4. Update deployment configs if needed

## 🚀 Deployment Strategy

### Development → Staging → Production
1. **Local Development**: Use demo mode for testing
2. **Staging Environment**: Real AI providers with test keys
3. **Production Environment**: Optimized settings with monitoring

### Deployment Options
1. **Koyeb Dashboard**: Connect GitHub, set environment variables, deploy
2. **GitHub Actions**: Automated CI/CD with security checks
3. **CLI Deployment**: Direct deployment with scripts

## 📚 Documentation Strategy

### User Journey Documentation
- **New Developers**: README → Getting Started → Configuration
- **Security Focus**: API Key Summary → Key Management → DevOps Security
- **Deployment Focus**: Quick Deploy → Deployment Guide → EU Deployment

### Maintenance
- Keep README as single source of truth
- Use docs/ for detailed guides
- Maintain API_KEY_SUMMARY.md for quick reference
- Update docs/INDEX.md when adding new documentation

## 🔍 Monitoring and Maintenance

### Health Monitoring
```bash
npm run health              # Application health
curl /api/ai/status        # AI provider status
./scripts/check-config.sh  # Configuration validation
```

### Regular Maintenance
- **Monthly**: Rotate API keys
- **Weekly**: Check usage and costs
- **Daily**: Monitor error rates and performance
- **On Deploy**: Run full test suite

## 🎯 Success Metrics

### Technical Metrics
- **Uptime**: >99.5% availability
- **Response Time**: <2s for entity extraction
- **Error Rate**: <1% failed requests
- **Security**: Zero key exposures, successful rate limiting

### User Experience Metrics
- **Setup Time**: <5 minutes from clone to running
- **Documentation**: Clear path for any user journey
- **Deployment**: <10 minutes from code to production
- **Maintenance**: Minimal operational overhead

## 🔄 Contribution Guidelines

### Code Contributions
1. Follow existing patterns in `src/`
2. Add comprehensive tests
3. Update relevant documentation
4. Use conventional commit messages

### Documentation Contributions
1. Keep user journey focus
2. Test all commands and examples
3. Update docs/INDEX.md when adding new docs
4. Maintain consistency with existing style

### Security Contributions
1. Never commit sensitive data
2. Follow security best practices
3. Update security documentation
4. Test with different environments

---

**This overview provides the 30,000-foot view of the project. For specific implementations, see the detailed documentation in the `docs/` directory.** 