import express from 'express';
import multer from 'multer';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import { AppError, ErrorHandler, withTimeout, timeouts } from '../utils/errorHandler.js';

const router = express.Router();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Temporarily allow all files for debugging
    console.log('File upload debug:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    // Accept audio files and some common formats that might not have proper mime types
    const allowedMimeTypes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/mpeg', 'audio/mp3', 'audio/mp4',
      'audio/webm', 'audio/ogg', 'audio/aiff',
      'audio/x-aiff', 'audio/m4a', 'audio/x-m4a'
    ];
    
    const allowedExtensions = ['.wav', '.mp3', '.mp4', '.webm', '.ogg', '.aiff', '.m4a'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (file.mimetype.startsWith('audio/') || 
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(fileExtension)) {
      console.log('✅ Audio file accepted:', file.originalname, file.mimetype);
      cb(null, true);
    } else {
      console.log('❌ File rejected:', file.originalname, file.mimetype, fileExtension);
      cb(null, true); // Temporarily accept all files for debugging
    }
  }
});

// Health check
router.get('/health', ErrorHandler.wrapAsync(async (req, res) => {
  const { mastraAgent, mcpService } = req.app.locals;
  
  // Check service availability
  const services = {
    database: 'unknown',
    mcp: 'unknown',
    mastra: 'unknown',
    ai_providers: {}
  };
  
  try {
    // Check MCP service with timeout
    if (mcpService) {
      await withTimeout(mcpService.getStats(), 5000, 'database');
      services.mcp = 'active';
      services.database = 'connected';
    } else {
      services.mcp = 'unavailable';
      services.database = 'unavailable';
    }
  } catch (error) {
    services.mcp = 'error';
    services.database = 'error';
  }
  
  try {
    // Check Mastra agent
    if (mastraAgent) {
      const providerStatus = mastraAgent.getProviderStatus();
      services.mastra = 'ready';
      services.ai_providers = {
        current: providerStatus.current,
        available: providerStatus.available,
        openai: providerStatus.openaiAvailable ? 'available' : 'unavailable',
        mistral: providerStatus.mistralAvailable ? 'available' : 'unavailable'
      };
    } else {
      services.mastra = 'unavailable';
      services.ai_providers = { current: 'none', available: ['demo'] };
    }
  } catch (error) {
    services.mastra = 'error';
    services.ai_providers = { current: 'error', available: [] };
  }
  
  // Determine overall status
  const allServicesHealthy = services.mcp === 'active' && services.mastra === 'ready';
  const status = allServicesHealthy ? 'healthy' : 'degraded';
  
  res.json({ 
    status,
    timestamp: new Date().toISOString(),
    services,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
}));

// Transcribe audio (with upload rate limiting)
router.post('/transcribe', uploadLimiter, upload.single('audio'), async (req, res) => {
  try {
    const { mastraAgent } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcription = await mastraAgent.transcribe(req.file.buffer);
    
    res.json({
      success: true,
      transcription,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ 
      error: 'Transcription failed',
      message: error.message 
    });
  }
});

// Process audio (transcribe + extract entities) (with AI rate limiting)
router.post('/process-audio', aiLimiter, upload.single('audio'), ErrorHandler.wrapAsync(async (req, res) => {
  const { mastraAgent } = req.app.locals;
  
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
      provider: mastraAgent.aiProvider,
      filename: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    
    // Provide specific error messages based on error type
    if (error.message.includes('timeout')) {
      throw new AppError('Audio processing timed out', 'timeout', 408, 
        'Your audio file took too long to process. Please try with a shorter audio file.');
    } else if (error.message.includes('transcription') || error.message.includes('audio')) {
      throw new AppError('Audio processing failed', 'transcription', 400, 
        'Unable to process the audio file. Please ensure it\'s a valid audio format.');
    } else if (error.message.includes('API') || error.message.includes('provider')) {
      throw new AppError('AI service error', 'ai_provider', 503, 
        'The AI service is temporarily unavailable. Please try again later.');
    } else {
      throw new AppError('Audio processing failed', 'general', 500, 
        'An error occurred while processing your audio. Please try again.');
    }
  }
}));

// Process text input for entity extraction
router.post('/extract-entities', aiLimiter, ErrorHandler.wrapAsync(async (req, res) => {
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

  console.log(`🔍 Processing text with ${mastraAgent.aiProvider}: "${text.substring(0, 50)}..."`);
  
  try {
    // Use the new processTextInput method with timeout
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
      provider: mastraAgent.aiProvider,
      processedAt: result.processedAt,
      inputLength: text.length
    });
  } catch (error) {
    console.error('Text processing error:', error);
    
    // Provide specific error messages based on error type
    if (error.message.includes('timeout')) {
      throw new AppError('Text processing timed out', 'timeout', 408, 
        'The text analysis took too long to complete. Please try with shorter text.');
    } else if (error.message.includes('API') || error.message.includes('provider')) {
      throw new AppError('AI service error', 'ai_provider', 503, 
        'The AI service is temporarily unavailable. Please try again later.');
    } else if (error.message.includes('rate') || error.message.includes('quota')) {
      throw new AppError('Rate limit exceeded', 'ratelimit', 429, 
        'AI service rate limit exceeded. Please wait a moment before trying again.');
    } else {
      throw new AppError('Text processing failed', 'general', 500, 
        'An error occurred while analyzing your text. Please try again.');
    }
  }
}));

// Get entities
router.get('/entities', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    const { type, limit } = req.query;
    
    const result = await mcpService.executeTool('get_entities', {
      type,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json(result);
  } catch (error) {
    console.error('Get entities error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve entities',
      message: error.message 
    });
  }
});

// Manually add entity
router.post('/entities', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    const entity = req.body;
    
    const result = await mcpService.executeTool('store_entity', entity);
    res.json(result);
  } catch (error) {
    console.error('Add entity error:', error);
    res.status(500).json({ 
      error: 'Failed to add entity',
      message: error.message 
    });
  }
});

// Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    const stats = await mcpService.getStats();
    
    res.json({
      success: true,
      stats,
      databaseEngine: 'DuckDB Neo',
      typeSystem: 'TypeScript',
      mcpService: 'Type-safe'
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics',
      message: error.message 
    });
  }
});

// Get MCP capabilities
router.get('/mcp/capabilities', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    
    const resources = await mcpService.getResources();
    
    res.json({
      success: true,
      capabilities: mcpService.capabilities,
      tools: mcpService.getTools(),
      resources: resources,
      typeSystem: 'TypeScript',
      database: 'DuckDB Neo'
    });
  } catch (error) {
    console.error('MCP capabilities error:', error);
    res.status(500).json({ 
      error: 'Failed to get MCP capabilities',
      message: error.message 
    });
  }
});

// Execute MCP tool
router.post('/mcp/tools/:toolName', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    const { toolName } = req.params;
    const args = req.body;
    
    const result = await mcpService.executeTool(toolName, args);
    res.json(result);
  } catch (error) {
    console.error('MCP tool execution error:', error);
    res.status(500).json({ 
      error: 'Tool execution failed',
      message: error.message 
    });
  }
});

// AI Provider Management Endpoints

// Get current AI provider status
router.get('/ai/status', (req, res) => {
  try {
    const { mastraAgent } = req.app.locals;
    const status = mastraAgent.getProviderStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('AI status error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI provider status',
      message: error.message 
    });
  }
});

// Switch AI provider
router.post('/ai/provider', (req, res) => {
  try {
    const { mastraAgent } = req.app.locals;
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }
    
    mastraAgent.setAiProvider(provider);
    const status = mastraAgent.getProviderStatus();
    
    res.json({
      success: true,
      message: `Switched to ${provider.toUpperCase()}`,
      ...status
    });
  } catch (error) {
    console.error('AI provider switch error:', error);
    res.status(400).json({ 
      error: 'Failed to switch AI provider',
      message: error.message 
    });
  }
});

// Get available AI providers
router.get('/ai/providers', (req, res) => {
  try {
    const { mastraAgent } = req.app.locals;
    const providers = mastraAgent.getAvailableProviders();
    
    res.json({
      success: true,
      providers: providers.map(provider => ({
        name: provider,
        displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
        available: true
      }))
    });
  } catch (error) {
    console.error('AI providers error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI providers',
      message: error.message 
    });
  }
});

export default router; 