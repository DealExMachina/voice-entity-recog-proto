# Sales Buddy - AI Voice Entity Extraction

A sophisticated AI-powered entity extraction system that processes voice input, text, and audio files to identify and store entities using DuckDB via the Model Context Protocol (MCP). Features advanced email and calendar integration with multi-agent architecture.

## 🌟 Features

- **Multi-modal Input**: Voice recording, file upload, and direct text input
- **AI-Powered Processing**: Entity extraction using OpenAI GPT-4o-mini or Mistral AI  
- **Real-time Communication**: WebSocket integration for live updates
- **Database Storage**: DuckDB with optimized schema and MCP integration
- **Modern UI**: Glass morphism design with Tailwind CSS and production optimization
- **Multiple AI Providers**: OpenAI, Mistral AI, and Demo mode with runtime switching
- **Email & Calendar Integration**: Gmail, Google Calendar, and Outlook support
- **Agent System**: Multi-agent architecture with personas and specialized agents
- **Text-to-Speech**: Voice synthesis with multiple voice options
- **Production Ready**: Docker containerization, CI/CD, and Koyeb deployment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Optional: OpenAI API key for full functionality
- Optional: Google API credentials for email/calendar integration

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

#### Core Entity Processing
```bash
# Health check
GET /api/health

# Transcribe audio file
POST /api/transcribe

# Process audio (transcribe + extract entities)
POST /api/process-audio

# Extract entities from text
POST /api/extract-entities

# Get stored entities
GET /api/entities?type=person&limit=50

# Add entity manually
POST /api/entities

# Get database statistics
GET /api/stats
```

#### AI Provider Management
```bash
# Get current AI provider status
GET /api/ai/status

# Switch AI provider
POST /api/ai/provider

# List available providers
GET /api/ai/providers
```

#### Agent System
```bash
# Process with master agent
POST /api/master-agent/process

# Get master agent status
GET /api/master-agent/status

# Agent response generation
POST /api/agent/respond
```

#### Personas Management
```bash
# Get all personas
GET /api/personas

# Get persona by ID
GET /api/personas/:id

# Create new persona
POST /api/personas

# Update persona
PUT /api/personas/:id

# Delete persona
DELETE /api/personas/:id
```

#### Text-to-Speech
```bash
# Synthesize speech
POST /api/tts/synthesize

# Get available voices
GET /api/tts/voices
```

#### Integration Features
```bash
# Get integration status
GET /integration/status

# Start/stop sync processes
POST /integration/sync/start
POST /integration/sync/stop

# Get recent activity
GET /integration/activity

# Get analytics
GET /integration/analytics

# Search entities
GET /integration/entities/search?q=john

# Get entity summary
GET /integration/entities/:entityId/summary

# Get client timeline
GET /integration/entities/:entityId/timeline

# Schedule meeting
POST /integration/meetings

# Send email
POST /integration/email/send

# Create calendar event
POST /integration/calendar/events

# Get client communications
GET /integration/communications/:entityId
```

#### MCP Integration
```bash
# Get MCP capabilities
GET /api/mcp/capabilities

# Execute MCP tool
POST /api/mcp/tools/:toolName
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
                       │   Agent System   │
                       │                  │
                       │ • Master Agent   │
                       │ • Voice Processor│
                       │ • Entity Extractor│
                       │ • Response Gen   │
                       │ • Email Agent    │
                       │ • Calendar Agent │
                       └──────────────────┘
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

## 🔧 Agent System

### Available Agents
- **Master Agent**: Orchestrates multi-agent workflows
- **Voice Processor Agent**: Handles audio transcription and processing
- **Entity Extractor Agent**: Specialized entity extraction and analysis
- **Response Generator Agent**: Generates contextual responses
- **Email Agent**: Gmail/Outlook integration and processing
- **Calendar Agent**: Google Calendar/Outlook calendar integration

### Persona System
Create custom AI personas with:
- Name and description
- Voice configuration
- Personality traits
- Expertise areas

## � Email & Calendar Integration

### Supported Providers
- **Gmail**: OAuth2 integration
- **Google Calendar**: Full calendar management
- **Outlook**: Email and calendar (via API)
- **IMAP**: Generic email server support

### Integration Features
- Automatic email monitoring and entity extraction
- Calendar event processing and meeting scheduling
- Client communication tracking
- Unified timeline view across all channels
- Analytics and reporting

For detailed integration setup, see [Email and Calendar Integration Guide](docs/INTEGRATION_GUIDE.md).

## �🚀 Deployment

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

### Available Documentation
- [Getting Started Guide](docs/GETTING_STARTED.md) - Quick setup and development guide
- [API Documentation](docs/API.md) - Complete API reference for all endpoints  
- [Email and Calendar Integration Guide](docs/INTEGRATION_GUIDE.md) - Complete integration setup and usage

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
- **Integration**: Gmail API, Google Calendar API, IMAP
- **Database**: DuckDB with MCP protocol
- **Deployment**: Docker, GitHub Actions, Koyeb

### Environment Variables

#### Core Configuration
```bash
# AI Provider
OPENAI_API_KEY=sk-your-key
MISTRAL_API_KEY=your-key

# Database
DB_PATH=./data/sales-buddy.db
```

#### Email Integration
```bash
EMAIL_PROVIDER=gmail
EMAIL_CLIENT_ID=your-gmail-client-id
EMAIL_CLIENT_SECRET=your-gmail-client-secret
EMAIL_ACCESS_TOKEN=your-gmail-access-token
EMAIL_REFRESH_TOKEN=your-gmail-refresh-token
```

#### Calendar Integration
```bash
CALENDAR_PROVIDER=google
CALENDAR_CLIENT_ID=your-google-client-id
CALENDAR_CLIENT_SECRET=your-google-client-secret
CALENDAR_ACCESS_TOKEN=your-google-access-token
CALENDAR_REFRESH_TOKEN=your-google-refresh-token
```

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Configuration Issues**: `./scripts/check-config.sh`
- **API Testing**: Use `/api/health` for health checks
- **Integration Setup**: See [Integration Guide](docs/INTEGRATION_GUIDE.md)
- **Development**: Check console logs for detailed debugging 