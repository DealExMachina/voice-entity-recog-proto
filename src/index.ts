import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase } from './database/duckdb.js';
import { MastraAgent } from './agents/mastra-agent.js';
import { McpService } from './services/mcp-service.js';
import { generalLimiter, healthLimiter } from './middleware/rateLimiter.js';
import apiRoutes from './routes/api.js';
import type { 
  WebSocketMessage, 
  VoiceDataMessage, 
  EntitiesExtractedMessage 
} from './types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', true); // Trust reverse proxies (needed for Koyeb)
app.use(compression()); // Enable gzip compression
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets with caching in production
if (process.env.NODE_ENV === 'production') {
  app.use('/dist', express.static(path.join(__dirname, '../public/dist'), {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    lastModified: true
  }));
}

// Serve static files but exclude index.html to handle it with custom route
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0', // Cache HTML for 1 day in production
  index: false // Disable automatic index.html serving
}));

// Apply rate limiting
app.use('/api/health', healthLimiter);
app.use('/api', generalLimiter);

// Initialize services
let mastraAgent: MastraAgent;
let mcpService: McpService;

async function initializeServices(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Initialize MCP service
    mcpService = new McpService();
    await mcpService.initialize();
    console.log('✅ MCP service initialized');

    // Initialize Mastra agent
    mastraAgent = new MastraAgent();
    await mastraAgent.initialize();
    console.log('✅ Mastra agent initialized');

    // Make services available to routes
    app.locals.mastraAgent = mastraAgent;
    app.locals.mcpService = mcpService;

  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// WebSocket connections for real-time updates
wss.on('connection', (ws: WebSocket) => {
  console.log('📡 New WebSocket connection');
  
  ws.on('message', async (message: any) => {
    try {
      const data = JSON.parse(message.toString()) as WebSocketMessage;
      
      if (data.type === 'voice_data') {
        const voiceData = data as VoiceDataMessage;
        
        // Handle real-time voice data
        const audioBuffer = Buffer.from(voiceData.audio, 'base64');
        const transcription = await mastraAgent.transcribe(audioBuffer);
        const entities = await mastraAgent.extractEntities(transcription);
        
        // Store conversation via MCP
        const conversationResult = await mcpService.storeConversation({
          transcription,
          audio_duration: 0, // Duration not available in real-time
          metadata: {
            provider: mastraAgent.getProviderStatus().current,
            processedAt: new Date().toISOString(),
            entityCount: entities.length
          }
        });

        // Store entities if we have a conversation ID
        if (conversationResult.conversationId) {
          await mcpService.storeEntities(entities, conversationResult.conversationId);
        }
        
        // Send results back to client
        const response: EntitiesExtractedMessage = {
          type: 'entities_extracted',
          transcription,
          entities,
          conversationId: conversationResult.conversationId || ''
        };
        
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      const errorMessage: WebSocketMessage = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown WebSocket error'
      };
      ws.send(JSON.stringify(errorMessage));
    }
  });

  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
  });
});

// API routes
app.use('/api', apiRoutes);

// Serve main app (production optimized HTML in production)
app.get('/', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const htmlFile = isProduction ? '../public/index.production.html' : '../public/index.html';
  const fullPath = path.join(__dirname, htmlFile);
  
  // Send the appropriate HTML file based on environment
  res.sendFile(fullPath, (err?: Error) => {
    if (err && isProduction) {
      // Fallback to development HTML if production file doesn't exist
      console.warn('Production HTML not found, falling back to development HTML');
      res.sendFile(path.join(__dirname, '../public/index.html'));
    }
  });
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
async function startServer(): Promise<void> {
  await initializeServices();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_PATH || './data/entities.db'}`);
    console.log(`🎯 AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}); 