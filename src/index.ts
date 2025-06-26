import express, { Application } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { MastraAgent } from './agents/mastra-agent.js';
import { McpService } from './services/mcp-service-ts.js';
import { generalLimiter, healthLimiter } from './middleware/rateLimiter.js';
import { ErrorHandler, withTimeout, timeouts } from './utils/errorHandler.js';
import apiRoutes from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware configuration
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

// Service instances
let mastraAgent: MastraAgent | null = null;
let mcpService: McpService | null = null;

// Service initialization with robust error handling and retries
async function initializeServices(): Promise<void> {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Initializing services (attempt ${attempt}/${maxRetries})...`);
      
      // Initialize TypeScript MCP service with DuckDB Neo (with timeout)
      mcpService = new McpService();
      
      const mcpInitTimeout = withTimeout(
        mcpService.initialize(),
        15000, // 15 second timeout
        'database'
      );
      
      await mcpInitTimeout;
      console.log('✅ MCP service initialized with DuckDB Neo');

      // Initialize Mastra agent with TypeScript MCP service (with timeout)
      mastraAgent = new MastraAgent(mcpService);
      
      const agentInitTimeout = withTimeout(
        mastraAgent.initialize(),
        10000, // 10 second timeout
        'ai_provider'
      );
      
      await agentInitTimeout;
      console.log('✅ Mastra agent initialized with TypeScript MCP');

      // Make services available to routes
      app.locals.mastraAgent = mastraAgent;
      app.locals.mcpService = mcpService;
      
      console.log('🎉 All services initialized successfully');
      return; // Success, exit the retry loop

    } catch (error) {
      console.error(`❌ Failed to initialize services (attempt ${attempt}/${maxRetries}):`, 
        error instanceof Error ? error.message : String(error));
      
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
          console.error('🛑 Exiting due to initialization failure in development mode');
          process.exit(1);
        }
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// WebSocket connections for real-time updates with comprehensive error handling
wss.on('connection', (ws) => {
  console.log('📡 New WebSocket connection');
  
  // WebSocket operation timeout
  const wsTimeout = timeouts.WEBSOCKET; // 30 seconds
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'voice_data') {
        if (!mastraAgent) {
          throw new Error('AI services are not available');
        }

        // Add timeout wrapper for voice processing
        const processWithTimeout = withTimeout(
          (async () => {
            // Handle real-time voice data
            const transcription = await mastraAgent!.transcribe(data.audio);
            const entities = await mastraAgent!.extractEntities(transcription);
            
            // Store entities via MCP
            if (mcpService) {
              const storeResult = await mcpService.executeTool('store_entities', { entities });
              console.log('📝 Entities stored via WebSocket:', storeResult.success);
            }
            
            return { transcription, entities };
          })(),
          wsTimeout,
          'timeout'
        );
        
        const result = await processWithTimeout;
        
        // Send results back to client
        ws.send(JSON.stringify({
          type: 'entities_extracted',
          success: true,
          transcription: result.transcription,
          entities: result.entities,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      
      // Send user-friendly error message
      let userMessage = 'An error occurred while processing your request.';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          userMessage = 'The operation took too long to complete. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          userMessage = 'Connection issue detected. Please check your internet connection.';
        } else if (error.message.includes('transcription')) {
          userMessage = 'Unable to process the audio. Please ensure it\'s a valid audio file.';
        } else if (error.message.includes('available') || error.message.includes('service')) {
          userMessage = 'Services are temporarily unavailable. Please try again later.';
        }
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

  // Send initial status message
  ws.send(JSON.stringify({
    type: 'status',
    success: true,
    message: 'Connected to Mastra Voice Entity Extraction service',
    services: {
      mastra: !!mastraAgent,
      mcp: !!mcpService,
      ai_providers: mastraAgent ? mastraAgent.getAvailableProviders() : ['demo']
    },
    timestamp: new Date().toISOString()
  }));
});

// API routes
app.use('/api', apiRoutes);

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handling middleware (must be last)
app.use(ErrorHandler.handleApiError);

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close WebSocket server
    console.log('📡 Closing WebSocket connections...');
    wss.close();
    
    // Close HTTP server
    console.log('🌐 Closing HTTP server...');
    server.close();
    
    // Close database connections
    if (mcpService) {
      console.log('💾 Closing database connections...');
      await mcpService.close();
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Process signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, let the application handle it gracefully
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // For uncaught exceptions, we should exit after logging
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start server with enhanced startup logging
async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting Mastra Voice Entity Extraction server...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Node.js version: ${process.version}`);
    
    await initializeServices();
    
    server.listen(PORT, () => {
      console.log(`\n🎉 Server running successfully!`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📊 Database: ${process.env.DB_PATH || './data/entities.db'}`);
      console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
      console.log(`⚡ Rate Limiting: ${process.env.RATE_LIMIT_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
      console.log(`\n✨ Ready to process voice and text inputs!`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if ((error as any).code === 'EADDRINUSE') {
        console.error(`🚫 Port ${PORT} is already in use. Please choose a different port.`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer().catch((error) => {
  console.error('💥 Fatal startup error:', error);
  process.exit(1);
});