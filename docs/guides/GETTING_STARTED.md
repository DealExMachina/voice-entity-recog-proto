# Getting Started with Mastra Voice Entity Extraction

This guide will help you set up and run the Mastra Voice Entity Extraction prototype.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **OpenAI API Key** (for transcription and entity extraction)

## Quick Setup

### Option 1: Automated Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd mastra-voice-entity-extraction

# Run automated setup
npm run setup
```

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Create data directory
mkdir -p data

# Copy environment file
cp .env.example .env

# Edit .env file with your OpenAI API key
nano .env  # or use your preferred editor
```

## Configuration

Edit the `.env` file and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
PORT=3000
DB_PATH=./data/entities.db
NODE_ENV=development
```

## Running the Application

### Development Mode
```bash
npm run dev
```
This starts the server with automatic restart on file changes.

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test
```

## Using the Application

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Try the different input methods:**
   - **Voice Recording**: Click "Start Recording" and speak
   - **File Upload**: Upload an audio file (mp3, wav, m4a)
   - **Text Input**: Type or paste text for entity extraction

3. **View Results:**
   - Extracted entities appear in real-time
   - View transcriptions and analysis
   - Browse the entity database

## Features to Test

### Voice Input
- Record a sample conversation mentioning names, companies, dates
- Example: "Hi John, let's schedule a meeting with Acme Corp next Tuesday at 3 PM to discuss the $50,000 budget"

### Text Processing
Try these sample texts:

```
Meeting with Sarah Johnson from TechCorp about the Q4 budget of $250,000. We need to finalize the contract by December 15th and schedule a presentation for next Friday.
```

```
Customer complaint from Global Industries regarding delayed shipment to Chicago. Order #12345 was supposed to arrive yesterday. Contact our logistics partner FastShip LLC by 5 PM today.
```

### Expected Entities
The system should extract:
- **People**: Sarah Johnson, John
- **Organizations**: TechCorp, Acme Corp, Global Industries
- **Financial**: $250,000, $50,000
- **Dates**: next Tuesday, December 15th, yesterday
- **Times**: 3 PM, 5 PM
- **Locations**: Chicago
- **Products**: Order #12345

## API Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Text Entity Extraction
```bash
curl -X POST http://localhost:3000/api/extract-entities \
  -H "Content-Type: application/json" \
  -d '{"text": "Meeting with John Smith from Acme Corp next Tuesday"}'
```

### Get Entities
```bash
curl http://localhost:3000/api/entities
```

### Get Statistics
```bash
curl http://localhost:3000/api/stats
```

## Understanding the Results

### Entity Structure
Each extracted entity contains:
```json
{
  "type": "person",           // Entity category
  "value": "John Smith",      // Actual entity value
  "confidence": 0.95,         // Confidence score (0-1)
  "context": "Meeting with John Smith...", // Surrounding text
  "extractedAt": "2024-01-01T00:00:00.000Z" // Timestamp
}
```

### Entity Types
- `person`: People's names
- `organization`: Companies, departments, teams
- `location`: Places, addresses, cities
- `event`: Meetings, appointments, deadlines
- `product`: Items, services, features
- `financial`: Money amounts, budgets, costs
- `contact`: Email addresses, phone numbers
- `date`: Dates and date ranges
- `time`: Times and time ranges

## Troubleshooting

### Common Issues

1. **"OpenAI API key required" Error**
   - Ensure you've set `OPENAI_API_KEY` in your `.env` file
   - Verify the API key is valid and has sufficient credits

2. **Database Connection Errors**
   - Check that the `data` directory exists
   - Ensure write permissions in the project directory

3. **Audio Recording Not Working**
   - Grant microphone permissions in your browser
   - Use HTTPS in production for microphone access

4. **No Entities Extracted**
   - Try with the sample texts provided
   - Check the browser console for JavaScript errors
   - Verify the OpenAI API is responding

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

### Testing Without OpenAI

The application includes fallback pattern matching for testing without an OpenAI API key. It will extract basic entities using regex patterns.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Node.js API   │    │    DuckDB       │
│                 │    │                 │    │                 │
│ • Voice Input   │◄──►│ • Mastra Agent  │◄──►│ • Entities      │
│ • File Upload   │    │ • MCP Service   │    │ • Conversations │
│ • Text Input    │    │ • WebSocket     │    │ • Relationships │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Next Steps

1. **Customize Entity Types**: Modify `src/agents/mastra-agent.js` to add new entity categories
2. **Extend MCP Tools**: Add new tools in `src/services/mcp-service.js`
3. **Improve UI**: Enhance the web interface in `public/`
4. **Add Analytics**: Implement advanced entity relationship analysis
5. **Deploy**: Set up production deployment with environment-specific configurations

## Support

- Check the [API Documentation](docs/API.md)
- Review the [Architecture Overview](docs/ARCHITECTURE.md)
- Run tests with `npm test`
- Check browser console for client-side errors
- Review server logs for backend issues

Happy prototyping! 🚀 