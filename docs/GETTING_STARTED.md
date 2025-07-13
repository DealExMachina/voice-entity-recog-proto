# Getting Started Guide

This guide will help you quickly set up and run the Sales Buddy application for development or production use.

## Prerequisites

### Required Software
- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For cloning the repository

### Optional but Recommended
- **Docker**: For containerized deployment
- **VS Code**: For development

## Quick Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd sales-buddy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

#### Option A: Interactive Setup (Recommended)
```bash
./scripts/setup-keys.sh
```

#### Option B: Manual Setup
```bash
cp docker.env.example docker.env
```

Edit `docker.env` with your configuration:

```bash
# AI Configuration
OPENAI_API_KEY=sk-your-openai-key
MISTRAL_API_KEY=your-mistral-key

# Database
DB_PATH=./data/sales-buddy.db

# Email Integration (Optional)
EMAIL_PROVIDER=gmail
EMAIL_CLIENT_ID=your-gmail-client-id
EMAIL_CLIENT_SECRET=your-gmail-client-secret
EMAIL_ACCESS_TOKEN=your-gmail-access-token
EMAIL_REFRESH_TOKEN=your-gmail-refresh-token

# Calendar Integration (Optional)
CALENDAR_PROVIDER=google
CALENDAR_CLIENT_ID=your-google-client-id
CALENDAR_CLIENT_SECRET=your-google-client-secret
CALENDAR_ACCESS_TOKEN=your-google-access-token
CALENDAR_REFRESH_TOKEN=your-google-refresh-token
```

### 4. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm run build
npm start
```

### 5. Access the Application

Open your browser and navigate to:
- **Development**: http://localhost:3000
- **Production**: http://localhost:3000 (or your configured port)

## Configuration Options

### AI Providers

The application supports multiple AI providers:

#### OpenAI (Recommended)
```bash
OPENAI_API_KEY=sk-your-key-here
```

#### Mistral AI
```bash
MISTRAL_API_KEY=your-mistral-key
```

#### Demo Mode
No API key required - uses mock responses for testing.

### Database Configuration

#### Default (File-based)
```bash
DB_PATH=./data/sales-buddy.db
```

#### Custom Location
```bash
DB_PATH=/path/to/your/database.db
```

### Email Integration Setup

#### Gmail Setup
1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing

2. **Enable Gmail API**
   - Navigate to APIs & Services > Library
   - Search for "Gmail API" and enable it

3. **Create OAuth2 Credentials**
   - Go to APIs & Services > Credentials
   - Create Credentials > OAuth 2.0 Client IDs
   - Application type: Web application
   - Add authorized redirect URIs

4. **Configure Environment Variables**
   ```bash
   EMAIL_PROVIDER=gmail
   EMAIL_CLIENT_ID=your-client-id
   EMAIL_CLIENT_SECRET=your-client-secret
   EMAIL_ACCESS_TOKEN=your-access-token
   EMAIL_REFRESH_TOKEN=your-refresh-token
   ```

#### IMAP Setup (Alternative)
```bash
EMAIL_PROVIDER=imap
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SERVER=imap.gmail.com
EMAIL_PORT=993
EMAIL_USE_SSL=true
```

### Calendar Integration Setup

#### Google Calendar
1. **Enable Google Calendar API**
   - In Google Cloud Console
   - APIs & Services > Library
   - Search for "Google Calendar API" and enable

2. **Use Same OAuth2 Credentials**
   ```bash
   CALENDAR_PROVIDER=google
   CALENDAR_CLIENT_ID=your-client-id
   CALENDAR_CLIENT_SECRET=your-client-secret
   CALENDAR_ACCESS_TOKEN=your-access-token
   CALENDAR_REFRESH_TOKEN=your-refresh-token
   CALENDAR_ID=primary
   ```

## Development Workflow

### Project Structure
```
sales-buddy/
├── src/
│   ├── agents/          # AI agents (email, calendar, etc.)
│   ├── database/        # Database configuration and queries
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Core services (MCP, TTS, etc.)
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main application entry point
├── public/              # Static frontend files
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── tests/               # Test files
└── docker.env.example   # Environment configuration template
```

### Available Scripts

#### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run type-check   # Run TypeScript type checking
```

#### Testing
```bash
npm test             # Run tests
npm run health       # Check application health
```

#### Production
```bash
npm run build:production  # Build with optimizations
npm start                # Start production server
```

#### Utilities
```bash
npm run clean        # Clean build artifacts and reinstall
./scripts/check-config.sh  # Validate configuration
```

### Development Features

#### Hot Reload
The development server automatically reloads when you make changes to:
- TypeScript files in `src/`
- CSS files in `public/`
- HTML files in `public/`

#### TypeScript Support
- Full TypeScript support with type checking
- Strict type definitions for all API responses
- Auto-completion in supported IDEs

#### ESLint and Prettier
```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## Testing the Application

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. Test Text Entity Extraction
```bash
curl -X POST http://localhost:3000/api/extract-entities \
  -H "Content-Type: application/json" \
  -d '{"text": "Meeting with John Smith at Acme Corp tomorrow"}'
```

### 3. Test Audio Transcription
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F "audio=@/path/to/audio/file.wav"
```

### 4. Test AI Provider Status
```bash
curl http://localhost:3000/api/ai/status
```

### 5. Test Integration Status
```bash
curl http://localhost:3000/integration/status
```

## Web Interface Usage

### 1. Voice Recording
- Click the microphone button to start recording
- Speak your message
- Click stop to end recording
- The system will transcribe and extract entities automatically

### 2. File Upload
- Click the upload button
- Select an audio file (WAV, MP3, M4A, etc.)
- The system will process the file and extract entities

### 3. Text Input
- Type or paste text into the input field
- Click "Extract Entities" to process
- View extracted entities with confidence scores

### 4. AI Provider Selection
- Use the dropdown in the top-right to switch between providers
- Available: OpenAI, Mistral AI, Demo Mode

### 5. Results Display
- View entities organized by type (Person, Organization, etc.)
- See confidence scores for each entity
- Access detailed analysis and context

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

#### Database Connection Issues
```bash
# Check database path permissions
ls -la ./data/

# Create directory if missing
mkdir -p ./data
```

#### API Key Issues
```bash
# Validate configuration
./scripts/check-config.sh

# Check environment variables
echo $OPENAI_API_KEY
```

#### Build Issues
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

### Log Levels

The application uses different log levels:
- **INFO**: General application flow
- **WARN**: Potential issues
- **ERROR**: Actual errors
- **DEBUG**: Detailed debugging information

## Docker Development

### Build Docker Image
```bash
docker build -t sales-buddy .
```

### Run with Docker Compose
```bash
# Copy environment file
cp docker.env.example docker.env

# Edit docker.env with your settings
vim docker.env

# Start services
docker-compose up
```

### Docker Environment Variables
```bash
# In docker.env
OPENAI_API_KEY=sk-your-key
MISTRAL_API_KEY=your-key
DB_PATH=/app/data/sales-buddy.db
```

## Production Deployment

### Manual Deployment
```bash
# Build for production
npm run build:production

# Set production environment
NODE_ENV=production

# Start application
npm start
```

### Automated Deployment
The application includes CI/CD configuration for:
- **GitHub Actions**: Automated testing and building
- **Koyeb**: One-click deployment platform
- **Docker**: Containerized deployment

See the main [README.md](../README.md) for deployment details.

## Next Steps

1. **Explore the API**: Use the [API Documentation](API.md) to understand all available endpoints
2. **Set up Integration**: Configure email and calendar integration using the [Integration Guide](INTEGRATION_GUIDE.md)
3. **Customize Agents**: Modify the AI agents in `src/agents/` to fit your needs
4. **Add Features**: Extend the application with new functionality

## Support

- **Configuration Issues**: Run `./scripts/check-config.sh`
- **API Testing**: Use `/api/health` endpoint
- **Development**: Check console logs for debugging
- **Integration**: See [Integration Guide](INTEGRATION_GUIDE.md)

## Resources

- [API Documentation](API.md)
- [Integration Guide](INTEGRATION_GUIDE.md)
- [Main README](../README.md)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Express.js Documentation](https://expressjs.com/)
- [DuckDB Documentation](https://duckdb.org/)