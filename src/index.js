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
import { ErrorHandler } from './utils/errorHandler.js';
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
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Initializing services (attempt ${attempt}/${maxRetries})...`);
      
      // Initialize TypeScript MCP service with DuckDB Neo (with timeout)
      mcpService = new McpService();
      
      const mcpInitTimeout = Promise.race([
        mcpService.initialize(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('MCP service initialization timed out'));
          }, 15000); // 15 second timeout
        })
      ]);
      
      await mcpInitTimeout;
      console.log('✅ MCP service initialized with DuckDB Neo');

      // Initialize Mastra agent with TypeScript MCP service (with timeout)
      mastraAgent = new MastraAgent(mcpService);
      
      const agentInitTimeout = Promise.race([
        mastraAgent.initialize(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Mastra agent initialization timed out'));
          }, 10000); // 10 second timeout
        })
      ]);
      
      await agentInitTimeout;
      console.log('✅ Mastra agent initialized with TypeScript MCP');

      // Make services available to routes
      app.locals.mastraAgent = mastraAgent;
      app.locals.mcpService = mcpService;
      
      console.log('🎉 All services initialized successfully');
      return; // Success, exit the retry loop

    } catch (error) {
      console.error(`❌ Failed to initialize services (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt === maxRetries) {
        console.error('💥 Failed to initialize services after all retry attempts');
        console.error('🔧 Please check your configuration and dependencies');
        
        // In production, we might want to start with limited functionality
        if (process.env.NODE_ENV === 'production') {
          console.log('🚨 Starting in limited mode without AI services');
          // Initialize minimal services for health checks
          app.locals.mastraAgent = null;
          app.locals.mcpService = null;
          return;
        } else {
          process.exit(1);
        }
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// WebSocket connections for real-time updates
wss.on('connection', (ws) => {
  console.log('📡 New WebSocket connection');
  
  // Add timeout for WebSocket operations
  const wsTimeout = 30000; // 30 seconds
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'voice_data') {
        // Add timeout wrapper for voice processing
        const processWithTimeout = Promise.race([
          (async () => {
            // Handle real-time voice data
            const transcription = await mastraAgent.transcribe(data.audio);
            const entities = await mastraAgent.extractEntities(transcription);
            
            // Store entities via MCP
            await mcpService.storeEntities(entities);
            
            return { transcription, entities };
          })(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('WebSocket operation timed out'));
            }, wsTimeout);
          })
        ]);
        
        const result = await processWithTimeout;
        
        // Send results back to client
        ws.send(JSON.stringify({
          type: 'entities_extracted',
          success: true,
          transcription: result.transcription,
          entities: result.entities
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      
      // Send user-friendly error message
      let userMessage = 'An error occurred while processing your request.';
      if (error.message.includes('timeout')) {
        userMessage = 'The operation took too long to complete. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        userMessage = 'Connection issue detected. Please check your internet connection.';
      } else if (error.message.includes('transcription')) {
        userMessage = 'Unable to process the audio. Please ensure it\'s a valid audio file.';
      }
      
      ws.send(JSON.stringify({
        type: 'error',
        success: false,
        message: userMessage,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
});

// API routes
app.use('/api', apiRoutes);

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware (must be last)
app.use(ErrorHandler.handleApiError);

// Start server
async function startServer() {
  await initializeServices();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_PATH || './data/entities.db'}`);
  });
}

startServer().catch(console.error); 