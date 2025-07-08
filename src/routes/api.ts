import express, { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import type { 
  ApiResponse, 
  HealthResponse, 
  AudioFile, 
  EntityType,
  ExtractedEntity,
  AIProvider
} from '../types/index.js';
import type { MastraAgent } from '../agents/mastra-agent.js';
import type { McpService } from '../services/mcp-service.js';

// Extend Express Request to include our app locals
declare global {
  namespace Express {
    interface Locals {
      mastraAgent: MastraAgent;
      mcpService: McpService;
    }
  }
}

const router = express.Router();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req: Request, file: any, cb: any) => {
    // Log upload details for debugging
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

// Note: Main health endpoint is now handled directly in src/index.ts for Koyeb compatibility

// Transcribe audio (with upload rate limiting)
router.post('/transcribe', uploadLimiter, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { mastraAgent } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      } as ApiResponse);
    }

    const transcription = await mastraAgent.transcribe(req.file.buffer);
    
    const response: ApiResponse<{
      transcription: string;
      filename: string;
      size: number;
    }> = {
      success: true,
      data: {
        transcription,
        filename: req.file.originalname,
        size: req.file.size
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Transcription error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
  return;
});

// Process audio (transcribe + extract entities) (with AI rate limiting)
router.post('/process-audio', aiLimiter, upload.single('audio'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { mastraAgent, mcpService } = req.app.locals;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      } as ApiResponse);
    }

    // Get audio duration from form data if provided
    const audioDuration = req.body.duration ? parseFloat(req.body.duration) : 0;

    console.log('🎤 Starting optimized audio processing pipeline...');
    console.log('📊 Audio details:', {
      size: req.file.buffer.length,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      duration: audioDuration
    });
    
    // Step 1: Transcribe audio (this is the main bottleneck)
    console.log('🔄 Step 1/4: Transcribing audio with AI...');
    const transcriptionStart = Date.now();
    const transcription = await mastraAgent.transcribe(req.file.buffer);
    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`✅ Transcription completed in ${transcriptionTime}ms:`, transcription.substring(0, 100) + '...');
    
    // Step 2: Extract entities (parallel potential, but depends on transcription)
    console.log('🔄 Step 2/4: Extracting entities from transcription...');
    const entityStart = Date.now();
    const entities = await mastraAgent.extractEntities(transcription);
    const entityTime = Date.now() - entityStart;
    console.log(`✅ Entity extraction completed in ${entityTime}ms:`, {
      count: entities.length,
      types: [...new Set(entities.map(e => e.type))]
    });

    // Steps 3 & 4: Store data (can be done in parallel)
    console.log('🔄 Step 3/4: Storing conversation and entities...');
    const storageStart = Date.now();
    
    // Store conversation first to get ID
    const conversationResult = await mcpService.storeConversation({
      transcription,
      audio_duration: audioDuration,
      metadata: {
        provider: 'openai',
        processedAt: new Date().toISOString(),
        entityCount: entities.length,
        audioSize: req.file.buffer.length,
        audioFormat: req.file.mimetype,
        processingTimes: {
          transcription: transcriptionTime,
          entityExtraction: entityTime
        }
      }
    });

    // Store entities if we have conversation ID and entities
    if (entities.length > 0 && conversationResult.conversationId) {
      console.log('🔄 Step 4/4: Storing extracted entities...');
      const entityPromises = entities.map(entity => 
        mcpService.storeEntity({
          type: entity.type,
          value: entity.value,
          confidence: entity.confidence,
          context: entity.context,
          source_conversation_id: conversationResult.conversationId!,
          metadata: {
            provider: 'openai',
            extractedAt: new Date().toISOString()
          }
        })
      );
      
      // Store all entities in parallel
      await Promise.all(entityPromises);
    }

    const storageTime = Date.now() - storageStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Complete pipeline finished in ${totalTime}ms:`, {
      transcription: `${transcriptionTime}ms`,
      entityExtraction: `${entityTime}ms`, 
      storage: `${storageTime}ms`,
      total: `${totalTime}ms`
    });

    const response: ApiResponse = {
      success: true,
      data: {
        transcription,
        entities,
        conversationId: conversationResult.conversationId,
        processedAt: new Date().toISOString(),
        performance: {
          totalProcessingTime: totalTime,
          transcriptionTime,
          entityExtractionTime: entityTime,
          storageTime
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ Audio processing failed after ${errorTime}ms:`, error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Audio processing failed',
      message: error instanceof Error ? 
        `${error.message} (failed after ${errorTime}ms)` : 
        `Unknown error (failed after ${errorTime}ms)`
    };
    res.status(500).json(errorResponse);
  }
  return;
});

// Extract entities from text (with AI rate limiting)
router.post('/extract-entities', aiLimiter, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };
    const { mastraAgent } = req.app.locals;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'No text provided' 
      } as ApiResponse);
    }

    const entities = await mastraAgent.extractEntities(text);
    const analysis = await mastraAgent.analyzeEntities(entities);

    const response: ApiResponse = {
      success: true,
      data: {
        text,
        entities,
        analysis
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Entity extraction error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Entity extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
  return;
});

// Get entities
router.get('/entities', async (req: Request, res: Response) => {
  try {
    const { mcpService } = req.app.locals;
    const { type, limit } = req.query as { 
      type?: EntityType; 
      limit?: string; 
    };
    
    const result = await mcpService.getEntities({
      ...(type && { type }),
      ...(limit && { limit: parseInt(limit, 10) })
    });

    res.json(result);
  } catch (error) {
    console.error('Get entities error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to retrieve entities',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Manually add entity
router.post('/entities', async (req: Request, res: Response) => {
  try {
    const { mcpService } = req.app.locals;
    const entity = req.body as {
      type: EntityType;
      value: string;
      confidence?: number;
      context?: string;
      source_conversation_id?: string;
      metadata?: Record<string, unknown>;
    };
    
    const result = await mcpService.storeEntity(entity);
    res.json(result);
  } catch (error) {
    console.error('Add entity error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to add entity',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get database statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { mcpService } = req.app.locals;
    const stats = await mcpService.getStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get stats error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get MCP capabilities
router.get('/mcp/capabilities', async (req: Request, res: Response) => {
  try {
    const { mcpService } = req.app.locals;
    
    const response: ApiResponse = {
      success: true,
      data: {
        capabilities: mcpService.getCapabilities(),
        tools: mcpService.getTools(),
        resources: await mcpService.getResources()
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('MCP capabilities error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get MCP capabilities',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Execute MCP tool
router.post('/mcp/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const { mcpService } = req.app.locals;
    const { toolName } = req.params;
    const args = req.body;
    
    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      } as ApiResponse);
    }
    
    const result = await mcpService.executeTool(toolName, args);
    res.json(result);
  } catch (error) {
    console.error('MCP tool execution error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
  return;
});

// AI Provider Management Endpoints

// Get current AI provider status
router.get('/ai/status', (req: Request, res: Response) => {
  try {
    const { mastraAgent } = req.app.locals;
    const status = mastraAgent.getProviderStatus();
    
    const response: ApiResponse = {
      success: true,
      data: status
    };
    
    res.json(response);
  } catch (error) {
    console.error('AI status error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get AI provider status',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Switch AI provider
router.post('/ai/provider', (req: Request, res: Response) => {
  try {
    const { mastraAgent } = req.app.locals;
    const { provider }: { provider?: string } = req.body;
    
    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        error: 'Provider is required' 
      } as ApiResponse);
    }
    
    // Validate provider before casting
    const validProviders: string[] = ['openai', 'mistral', 'demo'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` 
      } as ApiResponse);
    }
    
    mastraAgent.setAiProvider(provider as AIProvider); // Now safe after validation
    const status = mastraAgent.getProviderStatus();
    
    const response: ApiResponse = {
      success: true,
      message: `Switched to ${provider.toUpperCase()}`,
      data: status
    };
    
    res.json(response);
  } catch (error) {
    console.error('AI provider switch error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to switch AI provider',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(400).json(errorResponse);
  }
  return;
});

// Get available AI providers
router.get('/ai/providers', (req: Request, res: Response) => {
  try {
    const { mastraAgent } = req.app.locals;
    const providers = mastraAgent.getAvailableProviders();
    
    const response: ApiResponse = {
      success: true,
      data: {
        providers: providers.map(provider => ({
          name: provider,
          displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
          available: true
        }))
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('AI providers error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get AI providers',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

export default router; 