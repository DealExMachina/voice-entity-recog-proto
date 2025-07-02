# Project Overview

## 📋 Repository Structure

```
sales-buddy/
├── 📄 README.md                 # Main project documentation
├── 📄 package.json              # Dependencies and scripts
├── 📄 Dockerfile                # Production container configuration
├── 📄 docker-compose.yml        # Local development with Docker
├── 📄 koyeb.yaml               # Deployment configuration
├── 📄 .env.example              # Environment template
│
├── 📁 src/                      # TypeScript application source
│   ├── 📄 index.ts              # Main server entry point
│   ├── 📁 agents/               # AI processing agents
│   ├── 📁 database/             # DuckDB integration
│   ├── 📁 middleware/           # Express middleware (rate limiting)
│   ├── 📁 routes/               # API route handlers
│   ├── 📁 services/             # MCP services
│   └── 📁 types/                # TypeScript type definitions
│
├── 📁 public/                   # Web interface with production optimization
│   ├── 📄 index.html            # Development web application
│   ├── 📄 index.production.html # Production-optimized HTML
│   ├── 📄 app.js                # Frontend JavaScript
│   ├── 📄 styles.css            # Tailwind CSS source
│   └── 📁 dist/                 # Minified production assets
│
├── 📁 scripts/                  # Essential utility scripts
│   ├── 📄 setup-keys.sh         # Interactive API key setup
│   └── 📄 check-config.sh       # Configuration verification
│
├── 📁 docs/                     # Comprehensive documentation
│   ├── 📄 INDEX.md              # Documentation navigation
│   ├── 📄 API.md                # API reference
│   ├── 📄 ARCHITECTURE.md       # System architecture
│   ├── 📁 guides/               # Setup and development guides
│   ├── 📁 security/             # Security and key management
│   └── 📁 deployment/           # Deployment guides
│
├── 📁 tests/                    # TypeScript tests
├── 📁 data/                     # Database files (gitignored)
├── 📁 deploy/                   # Deployment configurations
└── 📁 .github/                  # GitHub Actions CI/CD workflows
```

## 🎯 Project Goals

**Primary Goal**: Production-ready AI voice entity extraction system with modern architecture and deployment automation.

**Key Features**:
- TypeScript implementation with full type safety
- Multi-modal input (voice, file, text) processing
- Multiple AI providers (OpenAI, Mistral, Demo) with runtime switching
- Real-time WebSocket communication
- Production-optimized assets (99.7% CSS reduction)
- Secure API key management across environments
- Automated CI/CD with GitHub Actions + Koyeb deployment

## 🔧 Technology Stack

### Backend (TypeScript)
- **Runtime**: Node.js 22+ with ES modules
- **Framework**: Express.js with compression and caching
- **Database**: DuckDB with MCP protocol integration
- **AI Providers**: OpenAI (GPT-4o-mini, Whisper), Mistral AI
- **WebSocket**: Real-time communication with ws library
- **Validation**: Comprehensive input validation and error handling

### Frontend (Production Optimized)
- **Core**: Vanilla JavaScript with modern Web APIs
- **Styling**: Tailwind CSS (minified: 9.6KB vs 3MB CDN)
- **Icons**: Lucide icons
- **Assets**: Minified CSS/JS, preloading, DNS prefetch
- **Performance**: Gzip compression, asset caching, SEO optimization

### Infrastructure
- **Deployment**: Koyeb (EU Frankfurt region) with auto-scaling
- **CI/CD**: GitHub Actions with Docker image builds
- **Container**: Docker multi-stage builds (node:22-slim for DuckDB compatibility)
- **Security**: Rate limiting, environment isolation, secure headers

## 🚀 Quick Start Guide

### 1. Development Setup
```bash
git clone <repository-url>
cd sales-buddy
npm install
./scripts/setup-keys.sh  # Interactive setup
npm run dev
```

### 2. Production Build
```bash
npm run build:production  # TypeScript + optimized assets
npm start                 # Production server
```

### 3. Docker Deployment
```bash
cp docker.env.example docker.env
# Edit docker.env with your settings
docker-compose up
```

### 4. Automated Deployment
```bash
# Set GitHub repository secrets: KOYEB_TOKEN, OPENAI_API_KEY
git push origin main  # Triggers automated deployment
```

## 🏗️ Architecture Overview

### Request Flow
```
User Input → Web Interface → Express API → Rate Limiter → AI Provider
                                     ↓
DuckDB ← MCP Service ← Entity Processor ← AI Response
```

### Component Breakdown
- **MastraAgent**: Multi-provider AI coordination with TypeScript types
- **McpService**: Type-safe Model Context Protocol implementation
- **Rate Limiter**: Multi-tier protection (AI: 50/15min, Files: 20/15min)
- **Database Layer**: DuckDB with optimized schema and type safety
- **Web Interface**: Real-time UI with production optimization

## 🔐 Security & Performance Features

### API Key Management
- **Development**: `.env` files with validation
- **Production**: Koyeb environment variables
- **CI/CD**: GitHub Secrets with environment protection
- **Emergency**: Provider switching and key rotation procedures

### Production Optimization
- **Assets**: 99.7% CSS reduction (9.6KB vs 3MB)
- **Caching**: 1 year for static assets, 1 day for HTML
- **Compression**: Gzip middleware for all responses
- **Performance**: DNS prefetch, preloading, minification

### Rate Limiting
- **AI Operations**: 50 requests/15 minutes (expensive)
- **File Uploads**: 20 requests/15 minutes (resource intensive)  
- **General API**: 200 requests/15 minutes (standard)
- **Health Checks**: 1000 requests/15 minutes (monitoring)

## 📊 Development Workflow

### Build System
```bash
npm run build              # TypeScript compilation + assets
npm run build:production   # Production optimization
npm run dev               # Development with hot reload
npm run type-check        # TypeScript validation
npm test                  # Automated testing
```

### CI/CD Pipeline
1. **Code Push**: Triggers GitHub Actions
2. **Testing**: TypeScript compilation + test suite
3. **Docker Build**: Multi-stage production image
4. **Registry Push**: GitHub Container Registry (ghcr.io)
5. **Deployment**: Automated Koyeb service update
6. **Health Check**: Verify deployment success

## 🚀 Deployment Strategy

### Environment Progression
1. **Local Development**: Demo mode, TypeScript compilation
2. **CI/CD Testing**: Full test suite with dual TypeScript configs
3. **Production**: Optimized Docker image with minified assets

### Deployment Options
1. **GitHub Actions** (Recommended): Automated on push to main
2. **Demo Deployment**: `./deploy-demo.sh` for quick showcases
3. **Manual Docker**: Local container builds and deployment

## 📚 Documentation Structure

### Quick Access
- **README.md**: Main overview and quick start
- **docs/guides/API_PROVIDERS.md**: AI provider configuration
- **docs/security/API_KEY_MANAGEMENT.md**: Secure key handling

### Complete Documentation
- **Architecture**: System design and component interaction
- **API**: Complete endpoint documentation
- **Deployment**: Production deployment guides
- **Security**: DevOps security and best practices

## 🔍 Monitoring and Maintenance

### Health Monitoring
```bash
npm run health                    # Application health
curl /api/ai/status              # AI provider status
./scripts/check-config.sh        # Configuration validation
```

### Performance Monitoring
- **Asset Sizes**: CSS 9.6KB, JS 24.8KB (minified)
- **Response Times**: Cached assets, compressed responses
- **Database**: DuckDB performance optimization
- **Rate Limiting**: Request tracking and analytics

### Maintenance Tasks
- **Monthly**: API key rotation
- **Weekly**: Dependency updates
- **Daily**: Health check monitoring
- **As Needed**: Provider status verification 