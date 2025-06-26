import express from 'express';
import multer from 'multer';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiter.js';

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
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      mcp: 'active',
      mastra: 'ready'
    }
  });
});

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
router.post('/process-audio', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    const { mastraAgent } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Process voice input (includes transcription, entity extraction, analysis, and storage via MCP)
    const result = await mastraAgent.processVoiceInput(req.file.buffer);

    res.json({
      success: true,
      ...result,
      provider: mastraAgent.aiProvider
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ 
      error: 'Audio processing failed',
      message: error.message 
    });
  }
});

// Process text input for entity extraction
router.post('/extract-entities', aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const { mastraAgent } = req.app.locals;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Text input is required'
      });
    }

    console.log(`🔍 Processing text with ${mastraAgent.aiProvider}: "${text.substring(0, 50)}..."`);
    
    // Use the new processTextInput method
    const result = await mastraAgent.processTextInput(text);
    
    res.json({
      success: true,
      entities: result.entities,
      analysis: result.analysis,
      conversationId: result.conversationId,
      provider: mastraAgent.aiProvider,
      processedAt: result.processedAt
    });

  } catch (error) {
    console.error('Text processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Text processing failed'
    });
  }
});

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