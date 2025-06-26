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
      cb(null, true);
    } else {
      cb(new Error(`Only audio files are allowed. Received: ${file.mimetype}, Extension: ${fileExtension}`));
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
    const { mastraAgent, mcpService } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Process voice input
    const result = await mastraAgent.processVoiceInput(req.file.buffer);
    
    // Store conversation
    const conversationResult = await mcpService.storeConversation({
      transcription: result.transcription,
      audioDuration: req.body.duration || 0,
      metadata: {
        filename: req.file.originalname,
        fileSize: req.file.size
      }
    });

    // Store entities
    if (result.entities.length > 0) {
      await mcpService.storeEntities(result.entities.map(entity => ({
        ...entity,
        conversationId: conversationResult.conversationId
      })));
    }

    res.json({
      success: true,
      ...result,
      conversationId: conversationResult.conversationId
    });
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ 
      error: 'Audio processing failed',
      message: error.message 
    });
  }
});

// Extract entities from text (with AI rate limiting)
router.post('/extract-entities', aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const { mastraAgent } = req.app.locals;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const entities = await mastraAgent.extractEntities(text);
    const analysis = await mastraAgent.analyzeEntities(entities);

    res.json({
      success: true,
      text,
      entities,
      analysis
    });
  } catch (error) {
    console.error('Entity extraction error:', error);
    res.status(500).json({ 
      error: 'Entity extraction failed',
      message: error.message 
    });
  }
});

// Get entities
router.get('/entities', async (req, res) => {
  try {
    const { mcpService } = req.app.locals;
    const { type, limit } = req.query;
    
    const result = await mcpService.getEntities({
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
    
    const result = await mcpService.storeEntity(entity);
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
      stats
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
router.get('/mcp/capabilities', (req, res) => {
  const { mcpService } = req.app.locals;
  
  res.json({
    capabilities: mcpService.capabilities,
    tools: mcpService.getTools(),
    resources: mcpService.getResources()
  });
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