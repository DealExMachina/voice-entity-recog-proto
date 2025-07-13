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
import { TTSService } from './services/tts-service.js';
import { IntegrationService } from './services/integration-service.js';
import { generalLimiter, healthLimiter } from './middleware/rateLimiter.js';
import apiRoutes from './routes/api.js';
import integrationRoutes from './routes/integration-api.js';
import type { 
  WebSocketMessage, 
  VoiceDataMessage, 
  EntitiesExtractedMessage,
  StreamingStartedMessage,
  TranscriptionChunkMessage,
  StreamingErrorMessage,
  StartStreamingMessage,
  EndStreamingMessage
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

// Direct health endpoint for Koyeb (BEFORE rate limiting)
app.get('/health', (req: Request, res: Response): void => {
  // Check if server is completely ready (set only after server.listen() completes)
  if (!serverReady) {
    // Server not completely ready yet - return 503 Service Unavailable
    res.status(503).json({
      status: 'starting',
      timestamp: new Date().toISOString(),
      services: [
        { name: 'database', status: 'initializing', lastCheck: new Date().toISOString() },
        { name: 'mcp', status: 'initializing', lastCheck: new Date().toISOString() },
        { name: 'mastra', status: 'initializing', lastCheck: new Date().toISOString() }
      ],
      version: '1.0.0'
    });
    return;
  }
  
  // Server is completely ready - return 200 OK
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: [
      { name: 'database', status: 'up', lastCheck: new Date().toISOString() },
      { name: 'mcp', status: 'up', lastCheck: new Date().toISOString() },
      { name: 'mastra', status: 'up', lastCheck: new Date().toISOString() }
    ],
    version: '1.0.0'
  });
});

// Apply rate limiting only to API routes
app.use('/api', generalLimiter);

// Initialize services
let mastraAgent: MastraAgent;
let mcpService: McpService;
let ttsService: TTSService;
let integrationService: IntegrationService;
let serverReady = false; // Flag to track when server is completely ready

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

    // Initialize TTS service
    ttsService = new TTSService();
    await ttsService.initialize();
    console.log('✅ TTS service initialized');

    // Initialize Integration service
    integrationService = new IntegrationService(mastraAgent);
    await integrationService.initialize();
    console.log('✅ Integration service initialized');

    // Make services available to routes
    app.locals.mastraAgent = mastraAgent;
    app.locals.mcpService = mcpService;
    app.locals.ttsService = ttsService;
    app.locals.integrationService = integrationService;

  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// WebSocket connections for real-time updates
wss.on('connection', (ws: WebSocket) => {
  console.log('📡 New WebSocket connection');
  
  // Track streaming sessions
  const streamingSessions = new Map<string, {
    audioChunks: Buffer[];
    transcription: string;
    startTime: number;
    provider: string;
  }>();
  
  ws.on('message', async (message: any) => {
    try {
      const data = JSON.parse(message.toString()) as WebSocketMessage;
      
      if (data.type === 'start_streaming') {
        // Initialize a new streaming session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        streamingSessions.set(sessionId, {
          audioChunks: [],
          transcription: '',
          startTime: Date.now(),
          provider: (data as StartStreamingMessage).provider || 'openai'
        });
        
        // Send session confirmation
        const response: StreamingStartedMessage = {
          type: 'streaming_started',
          sessionId
        };
        ws.send(JSON.stringify(response));
        console.log('🎬 Streaming session started:', sessionId);
        
      } else if (data.type === 'voice_data') {
        const voiceData = data as VoiceDataMessage;
        
        if (voiceData.sessionId && streamingSessions.has(voiceData.sessionId)) {
          const session = streamingSessions.get(voiceData.sessionId)!;
          
          // Decode and store audio chunk
          const audioBuffer = Buffer.from(voiceData.audio, 'base64');
          session.audioChunks.push(audioBuffer);
          
          // Process audio chunk for real-time transcription
          if (session.audioChunks.length >= 2) { // Process after we have enough chunks
            try {
              // Combine recent chunks for processing
              const recentChunks = session.audioChunks.slice(-4); // Last 4 chunks (1 second at 250ms chunks)
              const combinedAudio = Buffer.concat(recentChunks);
              
              // Get transcription for this chunk
              const chunkTranscription = await mastraAgent.transcribe(combinedAudio);
              
              // Update session transcription
              if (chunkTranscription && chunkTranscription.trim()) {
                session.transcription = chunkTranscription;
                
                // Send partial transcription back to client
                const transcriptionResponse: TranscriptionChunkMessage = {
                  type: 'transcription_chunk',
                  transcription: session.transcription,
                  isFinal: false
                };
                ws.send(JSON.stringify(transcriptionResponse));
              }
            } catch (error) {
              console.error('Chunk transcription error:', error);
            }
          }
        }
        
      } else if (data.type === 'end_streaming') {
        const endData = data as EndStreamingMessage;
        
        if (endData.sessionId && streamingSessions.has(endData.sessionId)) {
          const session = streamingSessions.get(endData.sessionId)!;
          
          try {
            // Combine all audio chunks for final processing
            const fullAudio = Buffer.concat(session.audioChunks);
            
            // Get final transcription
            const finalTranscription = await mastraAgent.transcribe(fullAudio);
            
            // Extract entities from final transcription
            const entities = await mastraAgent.extractEntities(finalTranscription);
            
            // Store conversation via MCP
            const conversationResult = await mcpService.storeConversation({
              transcription: finalTranscription,
              audio_duration: (Date.now() - session.startTime) / 1000,
              metadata: {
                provider: session.provider,
                processedAt: new Date().toISOString(),
                entityCount: entities.length,
                streamingSession: true
              }
            });

            // Store entities if we have a conversation ID
            if (conversationResult.conversationId) {
              await mcpService.storeEntities(entities, conversationResult.conversationId);
            }
            
            // Send final results back to client
            const finalResponse: EntitiesExtractedMessage = {
              type: 'entities_extracted',
              transcription: finalTranscription,
              entities,
              conversationId: conversationResult.conversationId || ''
            };
            
            ws.send(JSON.stringify(finalResponse));
            
            // Clean up session
            streamingSessions.delete(endData.sessionId);
            console.log('✅ Streaming session completed:', endData.sessionId);
            
          } catch (error) {
            console.error('Final processing error:', error);
            const errorResponse: StreamingErrorMessage = {
              type: 'streaming_error',
              error: error instanceof Error ? error.message : 'Unknown streaming error'
            };
            ws.send(JSON.stringify(errorResponse));
            streamingSessions.delete(endData.sessionId);
          }
        }
        
      } else if (data.type === 'voice_data') {
        // Legacy voice data handling (fallback)
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
    // Clean up any active streaming sessions for this connection
    streamingSessions.clear();
  });
});

// API routes
app.use('/api', apiRoutes);
app.use('/integration', integrationRoutes);

// Serve main app (always use development HTML for consistent UX)
app.get('/', (req: Request, res: Response) => {
  const htmlFile = '../public/index.html'; // Always use development HTML
  const fullPath = path.join(__dirname, htmlFile);
  
  // Send the development HTML file
  res.sendFile(fullPath, (err?: Error) => {
    if (err) {
      console.error('Failed to serve HTML file:', err);
      res.status(500).send('Internal Server Error');
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
  
  const HOST = '0.0.0.0'; // Explicitly bind to all interfaces for Koyeb
  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  server.listen(portNumber, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${portNumber}`);
    console.log(`📊 Database: ${process.env.DB_PATH || './data/entities.db'}`);
    console.log(`🎯 AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
    
    // Set ready flag ONLY after server is completely listening and ready
    serverReady = true;
    console.log(`✅ Server ready for health checks`);
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