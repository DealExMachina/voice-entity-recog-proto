import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { MastraAgent } from './agents/mastra-agent.js';
import { McpService } from './services/mcp-service.js';
import { generalLimiter, healthLimiter } from './middleware/rateLimiter.js';
import apiRoutes from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', false);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://voice-entity-app-dealexmachina-db6bcb98.koyeb.app'] : 
    ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Apply rate limiting
app.use('/api/health', healthLimiter);
app.use('/api', generalLimiter);

// Initialize services
let mastraAgent;
let mcpService;

async function initializeServices() {
  try {
    // Initialize TypeScript MCP service with DuckDB Neo
    mcpService = new McpService();
    await mcpService.initialize();
    console.log('✅ MCP service initialized with DuckDB Neo');

    // Initialize Mastra agent with TypeScript MCP service
    mastraAgent = new MastraAgent(mcpService);
    await mastraAgent.initialize();
    console.log('✅ Mastra agent initialized with TypeScript MCP');

    // Make services available to routes
    app.locals.mastraAgent = mastraAgent;
    app.locals.mcpService = mcpService;

  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// WebSocket connections for real-time updates
wss.on('connection', (ws) => {
  console.log('📡 New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'voice_data') {
        // Handle real-time voice data
        const transcription = await mastraAgent.transcribe(data.audio);
        const entities = await mastraAgent.extractEntities(transcription);
        
        // Store entities via MCP
        await mcpService.storeEntities(entities);
        
        // Send results back to client
        ws.send(JSON.stringify({
          type: 'entities_extracted',
          transcription,
          entities
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
  });
});

// API routes
app.use('/api', apiRoutes);

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
async function startServer() {
  await initializeServices();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_PATH || './data/entities.db'}`);
  });
}

startServer().catch(console.error); 