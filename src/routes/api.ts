import express, { Request, Response } from 'express';
import multer from 'multer';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { AppError, ErrorHandler, withTimeout, timeouts, createHealthResponse } from '../utils/errorHandler.js';
import { MastraAgent } from '../agents/mastra-agent.js';
import { McpService } from '../services/mcp-service-ts.js';

const router = express.Router();

// Type for application locals
interface AppLocals {
  mastraAgent: MastraAgent | null;
  mcpService: McpService | null;
}

// Configure multer for audio uploads with enhanced validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file type validation
    console.log('File upload debug:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname,
      size: file.size
    });
    
    // Accept audio files and some common formats that might not have proper mime types
    const allowedMimeTypes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mpeg', 'audio/mp3', 'audio/mp4',
      'audio/webm', 'audio/ogg', 'audio/aiff',
      'audio/x-aiff', 'audio/m4a', 'audio/x-m4a',
      'audio/flac', 'audio/x-flac'
    ];
    
    const allowedExtensions = ['.wav', '.mp3', '.mp4', '.webm', '.ogg', '.aiff', '.m4a', '.flac'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (file.mimetype.startsWith('audio/') || 
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(fileExtension)) {
      console.log('✅ Audio file accepted:', file.originalname, file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File rejected:', file.originalname, file.mimetype, fileExtension);
      cb(new Error('Invalid file type. Please upload an audio file.'), false);
    }
  }
});

// Health check with comprehensive service validation
router.get('/health', ErrorHandler.wrapAsync(async (req: Request, res: Response) => {
  const { mastraAgent, mcpService } = req.app.locals as AppLocals;
  
  // Check service availability with detailed status
  const services: Record<string, 'connected' | 'active' | 'ready' | 'unavailable' | 'error'> = {
    database: 'unavailable',
    mcp: 'unavailable',
    mastra: 'unavailable'
  };

  const additionalInfo: Record<string, any> = {};
  
  try {
    // Check MCP service with timeout
    if (mcpService) {
      const stats = await withTimeout(mcpService.getStats(), 5000, 'database');
      if (stats.error) {
        services.mcp = 'error';
        services.database = 'error';
        additionalInfo.mcp_error = stats.error;
      } else {
        services.mcp = 'active';
        services.database = 'connected';
        additionalInfo.database_stats = {
          totalEntities: stats.totalEntities,
          entityTypes: Object.keys(stats.entityTypes || {}).length
        };
      }
    } else {
      services.mcp = 'unavailable';
      services.database = 'unavailable';
    }
  } catch (error) {
    services.mcp = 'error';
    services.database = 'error';
    additionalInfo.mcp_error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  try {
    // Check Mastra agent
    if (mastraAgent) {
      const providerStatus = mastraAgent.getProviderStatus();
      services.mastra = 'ready';
      additionalInfo.ai_providers = {
        current: providerStatus.current,
        available: providerStatus.available,
        openai: providerStatus.openaiAvailable ? 'available' : 'unavailable',
        mistral: providerStatus.mistralAvailable ? 'available' : 'unavailable'
      };
    } else {
      services.mastra = 'unavailable';
      additionalInfo.ai_providers = { current: 'none', available: ['demo'] };
    }
  } catch (error) {
    services.mastra = 'error';
    additionalInfo.mastra_error = error instanceof Error ? error.message : 'Unknown error';
    additionalInfo.ai_providers = { current: 'error', available: [] };
  }
  
  // Create comprehensive health response
  const healthResponse = createHealthResponse(services, process.env.npm_package_version || '1.0.0');

  res.json({
    ...healthResponse,
    ...additionalInfo,
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
}));

// Transcribe audio (with upload rate limiting) - kept for backward compatibility
router.post('/transcribe', uploadLimiter, upload.single('audio'), ErrorHandler.wrapAsync(async (req: Request, res: Response) => {
  const { mastraAgent } = req.app.locals as AppLocals;
  
  if (!mastraAgent) {
    throw new AppError('AI services are temporarily unavailable', 'ai_provider', 503);
  }
  
  if (!req.file) {
    throw new AppError('No audio file provided', 'validation', 400, 'Please select an audio file to upload.');
  }

  console.log(`🎤 Transcribing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

  try {
    const transcription = await withTimeout(
      mastraAgent.transcribe(req.file.buffer),
      timeouts.TRANSCRIPTION,
      'transcription'
    );
    
    res.json({
      success: true,
      transcription,
      filename: req.file.originalname,
      size: req.file.size,
      provider: mastraAgent.getProviderStatus().current
    });
  } catch (error) {
    console.error('Transcription error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Transcription failed', 'transcription', 500, 
      'Unable to transcribe the audio file. Please ensure it\'s a valid audio format and try again.');
  }
}));

// Process audio (transcribe + extract entities) (with AI rate limiting)
router.post('/process-audio', aiLimiter, upload.single('audio'), ErrorHandler.wrapAsync(async (req: Request, res: Response) => {
  const { mastraAgent } = req.app.locals as AppLocals;
  
  // Check if services are available
  if (!mastraAgent) {
    throw new AppError('AI services are temporarily unavailable', 'ai_provider', 503);
  }
  
  if (!req.file) {
    throw new AppError('No audio file provided', 'validation', 400, 'Please select an audio file to upload.');
  }

  // Validate file size and type
  if (req.file.size > 10 * 1024 * 1024) { // 10MB limit
    throw new AppError('File too large', 'upload', 400, 'Audio file must be smaller than 10MB.');
  }

  if (req.file.size === 0) {
    throw new AppError('Empty file', 'validation', 400, 'The uploaded file appears to be empty.');
  }

  console.log(`🎵 Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

  try {
    // Process voice input with timeout (includes transcription, entity extraction, analysis, and storage via MCP)
    const result = await withTimeout(
      mastraAgent.processVoiceInput(req.file.buffer),
      timeouts.TRANSCRIPTION, // 2 minutes for audio processing
      'transcription'
    );

    console.log(`✅ Audio processing completed for ${req.file.originalname}`);

    res.json({
      success: true,
      ...result,
      provider: mastraAgent.getProviderStatus().current,
      filename: req.file.originalname,
      fileSize: req.file.size,
      processingTime: Date.now() - parseInt(req.file.originalname.split('_')[1] || '0') || 'unknown'
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    
    // Provide specific error messages based on error type
    if (error instanceof AppError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new AppError('Audio processing timed out', 'timeout', 408, 
          'Your audio file took too long to process. Please try with a shorter audio file.');
      } else if (error.message.includes('transcription') || error.message.includes('audio')) {
        throw new AppError('Audio processing failed', 'transcription', 400, 
          'Unable to process the audio file. Please ensure it\'s a valid audio format.');
      } else if (error.message.includes('API') || error.message.includes('provider')) {
        throw new AppError('AI service error', 'ai_provider', 503, 
          'The AI service is temporarily unavailable. Please try again later.');
      }
    }
    
    throw new AppError('Audio processing failed', 'general', 500, 
      'An error occurred while processing your audio. Please try again.');
  }
}));

// Process text input for entity extraction
router.post('/extract-entities', aiLimiter, ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { text } = req.body;
  const { mastraAgent } = req.app.locals;
  
  // Check if services are available
  if (!mastraAgent) {
    throw new AppError('AI services are temporarily unavailable', 'ai_provider', 503);
  }
  
  // Validate input
  if (!text || typeof text !== 'string') {
    throw new AppError('Text input is required', 'validation', 400, 
      'Please enter some text to analyze.');
  }
  
  if (text.trim().length === 0) {
    throw new AppError('Empty text provided', 'validation', 400, 
      'Please enter some text to analyze.');
  }
  
  if (text.length > 10000) { // 10k character limit
    throw new AppError('Text too long', 'validation', 400, 
      'Text must be shorter than 10,000 characters.');
  }

  console.log(`🔍 Processing text with ${mastraAgent.getProviderStatus().current}: "${text.substring(0, 50)}..."`);
  
  try {
    // Use the processTextInput method with timeout
    const result = await withTimeout(
      mastraAgent.processTextInput(text),
      timeouts.AI_REQUEST, // 45 seconds for AI processing
      'ai_provider'
    );
    
    console.log(`✅ Text processing completed (${result.entities.length} entities found)`);
    
    res.json({
      success: true,
      entities: result.entities,
      analysis: result.analysis,
      conversationId: result.conversationId,
      provider: mastraAgent.getProviderStatus().current,
      processedAt: result.processedAt,
      inputLength: text.length,
      processingTimeMs: Date.now() - Date.parse(result.processedAt)
    });
  } catch (error) {
    console.error('Text processing error:', error);
    
    // Provide specific error messages based on error type
    if (error instanceof AppError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new AppError('Text processing timed out', 'timeout', 408, 
          'The text analysis took too long to complete. Please try with shorter text.');
      } else if (error.message.includes('API') || error.message.includes('provider')) {
        throw new AppError('AI service error', 'ai_provider', 503, 
          'The AI service is temporarily unavailable. Please try again later.');
      } else if (error.message.includes('rate') || error.message.includes('quota')) {
        throw new AppError('Rate limit exceeded', 'ratelimit', 429, 
          'AI service rate limit exceeded. Please wait a moment before trying again.');
      }
    }
    
    throw new AppError('Text processing failed', 'general', 500, 
      'An error occurred while analyzing your text. Please try again.');
  }
}));

// Get entities with enhanced filtering and pagination
router.get('/entities', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mcpService } = req.app.locals;
  
  if (!mcpService) {
    throw new AppError('Database service unavailable', 'database', 503, 'Database service is temporarily unavailable.');
  }
  
  const { type, limit } = req.query;
  
  // Validate parameters
  const limitNum = limit ? parseInt(limit as string) : 50;
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    throw new AppError('Invalid limit parameter', 'validation', 400, 'Limit must be between 1 and 1000.');
  }

  try {
    const result = await withTimeout(
      mcpService.executeTool('get_entities', {
        type: type as string,
        limit: limitNum
      }),
      timeouts.DATABASE,
      'database'
    );

    if (!result.success) {
      throw new AppError('Database query failed', 'database', 500, result.error || 'Failed to retrieve entities.');
    }

    res.json({
      success: true,
      entities: result.entities || [],
      count: result.count || 0,
      filters: {
        type: type || 'all',
        limit: limitNum
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get entities error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to retrieve entities', 'database', 500, 
      'Unable to retrieve entities from the database. Please try again.');
  }
}));

// Manually add entity
router.post('/entities', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mcpService } = req.app.locals;
  
  if (!mcpService) {
    throw new AppError('Database service unavailable', 'database', 503, 'Database service is temporarily unavailable.');
  }
  
  const entity = req.body;
  
  // Validate entity structure
  if (!entity.type || !entity.value) {
    throw new AppError('Invalid entity data', 'validation', 400, 'Entity must have both type and value.');
  }
  
  if (typeof entity.type !== 'string' || typeof entity.value !== 'string') {
    throw new AppError('Invalid entity format', 'validation', 400, 'Entity type and value must be strings.');
  }

  try {
    const result = await withTimeout(
      mcpService.executeTool('store_entity', {
        ...entity,
        confidence: entity.confidence || 1.0,
        context: entity.context || '',
        metadata: {
          ...entity.metadata,
          source: 'manual_entry',
          createdAt: new Date().toISOString()
        }
      }),
      timeouts.DATABASE,
      'database'
    );

    if (!result.success) {
      throw new AppError('Failed to store entity', 'database', 500, result.error || 'Unable to save entity.');
    }

    res.json({
      success: true,
      entityId: result.entityId,
      message: 'Entity added successfully',
      entity: {
        ...entity,
        id: result.entityId,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Add entity error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to add entity', 'database', 500, 
      'Unable to add entity to the database. Please try again.');
  }
}));

// Get database statistics
router.get('/stats', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mcpService } = req.app.locals;
  
  if (!mcpService) {
    throw new AppError('Database service unavailable', 'database', 503, 'Database service is temporarily unavailable.');
  }

  try {
    const stats = await withTimeout(
      mcpService.getStats(),
      timeouts.DATABASE,
      'database'
    );
    
    if (stats.error) {
      throw new AppError('Statistics query failed', 'database', 500, stats.error);
    }
    
    res.json({
      success: true,
      stats,
      databaseEngine: 'DuckDB Neo',
      typeSystem: 'TypeScript',
      mcpService: 'Type-safe',
      performance: {
        queryTime: 'sub-second',
        reliability: 'high'
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to get statistics', 'database', 500, 
      'Unable to retrieve database statistics. Please try again.');
  }
}));

// Get MCP capabilities
router.get('/mcp/capabilities', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mcpService } = req.app.locals;
  
  if (!mcpService) {
    throw new AppError('MCP service unavailable', 'database', 503, 'MCP service is temporarily unavailable.');
  }

  try {
    const resources = await withTimeout(
      mcpService.getResources(),
      timeouts.DATABASE,
      'database'
    );
    
    res.json({
      success: true,
      capabilities: mcpService.capabilities,
      tools: mcpService.getTools(),
      resources: resources,
      typeSystem: 'TypeScript',
      database: 'DuckDB Neo',
      version: '2.0.0',
      features: [
        'Entity Storage',
        'Conversation Tracking',
        'Type Safety',
        'Circuit Breakers',
        'Timeout Handling'
      ]
    });
  } catch (error) {
    console.error('MCP capabilities error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to get MCP capabilities', 'database', 500, 
      'Unable to retrieve MCP capabilities. Please try again.');
  }
}));

// Execute MCP tool
router.post('/mcp/tools/:toolName', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mcpService } = req.app.locals;
  const { toolName } = req.params;
  const args = req.body;
  
  if (!mcpService) {
    throw new AppError('MCP service unavailable', 'database', 503, 'MCP service is temporarily unavailable.');
  }
  
  // Validate tool name
  const validTools = ['store_entity', 'get_entities', 'store_conversation', 'get_conversation'];
  if (!validTools.includes(toolName)) {
    throw new AppError('Invalid tool name', 'validation', 400, `Invalid tool: ${toolName}. Available tools: ${validTools.join(', ')}`);
  }

  try {
    const result = await withTimeout(
      mcpService.executeTool(toolName, args),
      timeouts.DATABASE,
      'database'
    );
    
    res.json({
      success: true,
      tool: toolName,
      result,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('MCP tool execution error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Tool execution failed', 'database', 500, 
      `Failed to execute tool "${toolName}". Please try again.`);
  }
}));

// AI Provider Management Endpoints

// Get current AI provider status
router.get('/ai/status', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mastraAgent } = req.app.locals;
  
  if (!mastraAgent) {
    res.json({
      success: true,
      current: 'unavailable',
      available: ['demo'],
      openaiAvailable: false,
      mistralAvailable: false,
      status: 'AI services are not initialized'
    });
    return;
  }

  try {
    const status = mastraAgent.getProviderStatus();
    
    res.json({
      success: true,
      ...status,
      circuitBreakers: {
        openai: mastraAgent['openaiCircuitBreaker']?.getState() || 'unknown',
        mistral: mastraAgent['mistralCircuitBreaker']?.getState() || 'unknown'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI status error:', error);
    
    throw new AppError('Failed to get AI provider status', 'ai_provider', 500, 
      'Unable to retrieve AI provider status. Please try again.');
  }
}));

// Switch AI provider
router.post('/ai/provider', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mastraAgent } = req.app.locals;
  const { provider } = req.body;
  
  if (!mastraAgent) {
    throw new AppError('AI services unavailable', 'ai_provider', 503, 'AI services are not initialized.');
  }
  
  if (!provider) {
    throw new AppError('Provider is required', 'validation', 400, 'Please specify an AI provider.');
  }
  
  try {
    mastraAgent.setAiProvider(provider);
    const status = mastraAgent.getProviderStatus();
    
    res.json({
      success: true,
      message: `Switched to ${provider.toUpperCase()}`,
      ...status,
      switchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI provider switch error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Failed to switch AI provider', 'ai_provider', 400, 
      'Unable to switch AI provider. Please check the provider name and try again.');
  }
}));

// Get available AI providers
router.get('/ai/providers', ErrorHandler.wrapAsync(async (req: RequestWithLocals, res: Response) => {
  const { mastraAgent } = req.app.locals;
  
  if (!mastraAgent) {
    res.json({
      success: true,
      providers: [{
        name: 'demo',
        displayName: 'Demo',
        available: true,
        features: ['Entity Extraction', 'Pattern Matching']
      }],
      message: 'AI services not initialized - demo mode only'
    });
    return;
  }

  try {
    const availableProviders = mastraAgent.getAvailableProviders();
    
    const providers = availableProviders.map(provider => ({
      name: provider,
      displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
      available: true,
      features: provider === 'demo' 
        ? ['Entity Extraction', 'Pattern Matching']
        : ['Entity Extraction', 'Audio Transcription', 'Advanced AI']
    }));
    
    res.json({
      success: true,
      providers,
      totalProviders: providers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI providers error:', error);
    
    throw new AppError('Failed to get AI providers', 'ai_provider', 500, 
      'Unable to retrieve available AI providers. Please try again.');
  }
}));

export default router;