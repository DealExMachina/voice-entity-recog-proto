import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import { AppError, withTimeout, timeouts, CircuitBreaker } from '../utils/errorHandler.js';
import { McpService } from '../services/mcp-service-ts.js';
import fs from 'fs';
import path from 'path';

// Type definitions for entities
export interface Entity {
  type: string;
  value: string;
  confidence: number;
  context: string;
  extractedAt?: string;
  provider?: string;
}

// Type definitions for analysis results
export interface EntityAnalysis {
  totalEntities: number;
  entityCounts: Record<string, number>;
  insights: string[];
  relationships: string[];
}

// Type definitions for processing results
export interface ProcessingResult {
  transcription?: string;
  entities: Entity[];
  analysis: EntityAnalysis;
  conversationId: string;
  processedAt: string;
}

// Provider status interface
export interface ProviderStatus {
  current: string;
  available: string[];
  openaiAvailable: boolean;
  mistralAvailable: boolean;
}

export class MastraAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: string;
  private mcpService: McpService | null;
  
  // Circuit breakers for AI providers
  private openaiCircuitBreaker: CircuitBreaker;
  private mistralCircuitBreaker: CircuitBreaker;
  
  private readonly entityTypes: string[] = [
    'person', 'organization', 'location', 'event', 
    'product', 'financial', 'contact', 'date', 'time'
  ];

  constructor(mcpService: McpService | null = null) {
    this.aiProvider = process.env.AI_PROVIDER || 'openai';
    this.mcpService = mcpService;
    
    // Initialize circuit breakers for AI providers
    this.openaiCircuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30s reset
    this.mistralCircuitBreaker = new CircuitBreaker(3, 30000);
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          maxRetries: 2
        });
      } catch (error) {
        console.warn('⚠️ Failed to initialize OpenAI:', error instanceof Error ? error.message : String(error));
      }
    }
    
    // Initialize Mistral if API key is available
    if (process.env.MISTRAL_API_KEY) {
      try {
        this.mistral = new Mistral({
          apiKey: process.env.MISTRAL_API_KEY
        });
      } catch (error) {
        console.warn('⚠️ Failed to initialize Mistral:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  // Set MCP service (dependency injection)
  setMcpService(mcpService: McpService): void {
    this.mcpService = mcpService;
  }

  async initialize(): Promise<boolean> {
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    if (this.mistral) availableProviders.push('Mistral');
    
    if (availableProviders.length > 0) {
      console.log(`🤖 Mastra agent initialized with: ${availableProviders.join(', ')}`);
      console.log(`🎯 Active provider: ${this.aiProvider.toUpperCase()}`);
    } else {
      console.log('🤖 Mastra agent initialized with demo mode (no AI API keys)');
    }
    return true;
  }

  // Method to switch AI provider with validation
  setAiProvider(provider: string): void {
    const validProviders = ['openai', 'mistral', 'demo'];
    if (!validProviders.includes(provider)) {
      throw new AppError(
        `Invalid AI provider: ${provider}`, 
        'validation', 
        400, 
        `Invalid AI provider. Available options: ${validProviders.join(', ')}`
      );
    }
    
    if (provider === 'openai' && !this.openai) {
      throw new AppError(
        'OpenAI not available - missing API key', 
        'ai_provider', 
        503, 
        'OpenAI is not configured. Please check your API key.'
      );
    }
    
    if (provider === 'mistral' && !this.mistral) {
      throw new AppError(
        'Mistral not available - missing API key', 
        'ai_provider', 
        503, 
        'Mistral AI is not configured. Please check your API key.'
      );
    }
    
    this.aiProvider = provider;
    console.log(`🔄 Switched AI provider to: ${provider.toUpperCase()}`);
  }

  // Get available providers
  getAvailableProviders(): string[] {
    const providers = ['demo'];
    if (this.openai) providers.push('openai');
    if (this.mistral) providers.push('mistral');
    return providers;
  }

  // Get current provider status
  getProviderStatus(): ProviderStatus {
    return {
      current: this.aiProvider,
      available: this.getAvailableProviders(),
      openaiAvailable: !!this.openai,
      mistralAvailable: !!this.mistral
    };
  }

  // Transcribe audio using available AI provider with error handling
  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (this.aiProvider === 'demo' || (!this.openai && !this.mistral)) {
      // Fallback for demo purposes when no API key
      return 'Demo transcription: We need to schedule a meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the new product launch budget of $50,000.';
    }

    try {
      let transcription: string;
      
      if (this.aiProvider === 'openai' && this.openai) {
        transcription = await withTimeout(
          this.openaiCircuitBreaker.execute(() => this.transcribeWithOpenAI(audioBuffer)),
          timeouts.TRANSCRIPTION,
          'transcription'
        );
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        // Mistral doesn't have audio transcription, fallback to demo
        console.warn('⚠️ Mistral AI doesn\'t support audio transcription yet. Using demo mode.');
        transcription = "Demo transcription: Mistral AI doesn't support audio transcription yet. Using sample text instead.";
      } else {
        throw new AppError(
          'Selected AI provider not available', 
          'ai_provider', 
          503, 
          'The selected AI provider is not available. Please try switching providers.'
        );
      }

      return transcription;
    } catch (error) {
      console.error(`Transcription error with ${this.aiProvider}:`, error);
      
      // If it's already an AppError, re-throw it
      if (error instanceof AppError) {
        throw error;
      }
      
      // Provide fallback with descriptive error
      console.log('🔄 Falling back to demo transcription due to error');
      return 'Sample transcription: We need to schedule a meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the new product launch budget of $50,000.';
    }
  }

  // OpenAI-specific transcription with robust error handling
  private async transcribeWithOpenAI(audioBuffer: Buffer): Promise<string> {
    if (!this.openai) {
      throw new AppError('OpenAI not configured', 'ai_provider', 503);
    }

    console.log('🎤 Attempting OpenAI Whisper transcription...');
    console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
    
    if (audioBuffer.length === 0) {
      throw new AppError('Empty audio buffer', 'validation', 400, 'The audio file appears to be empty.');
    }

    if (audioBuffer.length > 25 * 1024 * 1024) { // 25MB limit
      throw new AppError('Audio file too large', 'upload', 400, 'Audio file must be smaller than 25MB for transcription.');
    }
    
    try {
      // Write buffer to temporary file
      const tempDir = '/tmp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempPath = path.join(tempDir, `audio_${Date.now()}.wav`);
      await fs.promises.writeFile(tempPath, audioBuffer);
      
      console.log('📤 Sending audio file to OpenAI Whisper API...');
      
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      // Clean up temp file
      try {
        await fs.promises.unlink(tempPath);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }

      if (typeof response !== 'string') {
        throw new AppError('Invalid transcription response', 'transcription', 500, 'Received unexpected response from transcription service.');
      }

      if (!response || response.trim().length === 0) {
        throw new AppError('Empty transcription result', 'transcription', 400, 'No speech was detected in the audio file.');
      }

      console.log('✅ Whisper transcription successful');
      return response.trim();
    } catch (error) {
      // Clean up temp file on error
      const tempPath = path.join('/tmp', `audio_${Date.now()}.wav`);
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      if (error instanceof AppError) {
        throw error;
      }

      console.error('❌ Whisper API error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      });
      
      // Handle specific OpenAI API errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new AppError('Transcription timed out', 'timeout', 408, 'The audio transcription took too long. Please try with a shorter audio file.');
        } else if (error.message.includes('rate')) {
          throw new AppError('Rate limit exceeded', 'ratelimit', 429, 'OpenAI rate limit exceeded. Please wait before trying again.');
        } else if (error.message.includes('invalid') || error.message.includes('format')) {
          throw new AppError('Invalid audio format', 'transcription', 400, 'The audio file format is not supported. Please use a standard audio format.');
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          throw new AppError('API quota exceeded', 'ai_provider', 503, 'OpenAI API quota exceeded. Please check your account.');
        }
      }
      
      throw new AppError('Transcription failed', 'transcription', 500, 'Unable to transcribe the audio. Please try again or use a different audio file.');
    }
  }

  // Extract entities from text using AI provider with comprehensive error handling
  async extractEntities(text: string): Promise<Entity[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    if (this.aiProvider === 'demo' || (!this.openai && !this.mistral)) {
      return this.generateDemoEntities(text);
    }

    try {
      let entities: Entity[];
      
      if (this.aiProvider === 'openai' && this.openai) {
        entities = await withTimeout(
          this.openaiCircuitBreaker.execute(() => this.extractWithOpenAI(text)),
          timeouts.AI_REQUEST,
          'ai_provider'
        );
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        entities = await withTimeout(
          this.mistralCircuitBreaker.execute(() => this.extractWithMistral(text)),
          timeouts.AI_REQUEST,
          'ai_provider'
        );
      } else {
        // Fallback to demo if current provider not available
        entities = this.generateDemoEntities(text);
      }

      // Add metadata and validate
      return entities.map(entity => ({
        ...entity,
        confidence: entity.confidence || 0.8,
        context: entity.context || text.substring(0, 100),
        extractedAt: new Date().toISOString(),
        provider: this.aiProvider
      }));

    } catch (error) {
      console.error(`Entity extraction error with ${this.aiProvider}:`, error);
      
      // If it's already an AppError, re-throw it
      if (error instanceof AppError) {
        throw error;
      }
      
      // Fallback to demo entities with warning
      console.log('🔄 Falling back to demo entity extraction due to error');
      return this.generateDemoEntities(text);
    }
  }

  // OpenAI-specific entity extraction with detailed error handling
  private async extractWithOpenAI(text: string): Promise<Entity[]> {
    if (!this.openai) {
      throw new AppError('OpenAI not configured', 'ai_provider', 503);
    }

    const systemPrompt = `You are an expert Named Entity Recognition (NER) system specialized in extracting structured business information from conversational text.

CRITICAL INSTRUCTIONS:
1. Return a JSON object with an "entities" array
2. Do NOT include any explanatory text, markdown, or formatting
3. Each entity MUST have exactly these fields: type, value, confidence, context
4. Confidence should be a number between 0.1 and 1.0
5. Context should be a short phrase (10-30 words) containing the entity

ENTITY TYPES TO EXTRACT:
- person: Full names of individuals (not titles or roles)
- organization: Company names, departments, institutions
- location: Cities, countries, addresses, buildings
- event: Meetings, conferences, appointments, deadlines
- product: Specific products, services, or projects
- financial: Monetary amounts, budgets, costs, revenue
- contact: Email addresses, phone numbers
- date: Specific dates, days of week, relative dates
- time: Clock times, time ranges, durations

EXAMPLE OUTPUT FORMAT:
{
  "entities": [
    {"type": "person", "value": "John Smith", "confidence": 0.95, "context": "John Smith from Microsoft"},
    {"type": "organization", "value": "Microsoft", "confidence": 0.98, "context": "John Smith from Microsoft"},
    {"type": "financial", "value": "$50,000", "confidence": 0.92, "context": "budget of $50,000"}
  ]
}`;

    const userPrompt = `Extract entities from this text: "${text}"`;

    console.log('🔍 Sending to OpenAI for entity extraction...');
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const extractedText = response.choices[0]?.message?.content?.trim();
      
      if (!extractedText) {
        throw new AppError('Empty response from OpenAI', 'ai_provider', 500, 'The AI service returned an empty response.');
      }

      console.log('📥 OpenAI response received');
      
      try {
        const parsed = JSON.parse(extractedText);
        // If it's wrapped in an object, extract the array
        const entities = Array.isArray(parsed) ? parsed : (parsed.entities || []);
        
        // Validate entities structure
        if (!Array.isArray(entities)) {
          throw new Error('Response does not contain a valid entities array');
        }

        return entities.map((entity: any) => ({
          type: entity.type || 'unknown',
          value: entity.value || '',
          confidence: typeof entity.confidence === 'number' ? entity.confidence : 0.8,
          context: entity.context || text.substring(0, 100)
        }));
      } catch (parseError) {
        console.error('OpenAI JSON parse error:', parseError, 'Raw response:', extractedText);
        throw new AppError('Invalid response format', 'ai_provider', 500, 'The AI service returned an invalid response format.');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new AppError('OpenAI request timed out', 'timeout', 408);
        } else if (error.message.includes('rate')) {
          throw new AppError('OpenAI rate limit exceeded', 'ratelimit', 429);
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          throw new AppError('OpenAI quota exceeded', 'ai_provider', 503, 'OpenAI API quota exceeded. Please check your account.');
        }
      }

      throw new AppError('OpenAI entity extraction failed', 'ai_provider', 500, 'Failed to extract entities using OpenAI.');
    }
  }

  // Mistral-specific entity extraction with error handling
  private async extractWithMistral(text: string): Promise<Entity[]> {
    if (!this.mistral) {
      throw new AppError('Mistral not configured', 'ai_provider', 503);
    }

    const prompt = this.getEntityExtractionPrompt(text);

    try {
      const response = await this.mistral.chat.complete({
        model: 'mistral-small', // Cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are an expert entity extraction system. Extract entities accurately and return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        maxTokens: 1000
      });

      const extractedText = typeof response.choices?.[0]?.message?.content === 'string' 
        ? response.choices[0].message.content.trim() 
        : '';
      
      if (!extractedText) {
        throw new AppError('Empty response from Mistral', 'ai_provider', 500, 'The AI service returned an empty response.');
      }
      
      try {
        const entities = JSON.parse(extractedText);
        if (!Array.isArray(entities)) {
          throw new Error('Response is not an array');
        }
        return entities;
      } catch (parseError) {
        console.error('Mistral JSON parse error:', parseError);
        throw new AppError('Invalid response format', 'ai_provider', 500, 'The AI service returned an invalid response format.');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new AppError('Mistral request timed out', 'timeout', 408);
        } else if (error.message.includes('rate')) {
          throw new AppError('Mistral rate limit exceeded', 'ratelimit', 429);
        }
      }

      throw new AppError('Mistral entity extraction failed', 'ai_provider', 500, 'Failed to extract entities using Mistral AI.');
    }
  }

  // Common prompt for entity extraction
  private getEntityExtractionPrompt(text: string): string {
    return `
      Extract entities from the following text and categorize them. Return a JSON array of entities with the following structure:
      {
        "type": "entity_type",
        "value": "entity_value", 
        "confidence": 0.95,
        "context": "surrounding_context"
      }

      Entity types to look for:
      - person: People's names
      - organization: Companies, departments, teams
      - location: Places, addresses, cities, countries
      - event: Meetings, appointments, deadlines
      - product: Items, services, features
      - financial: Money amounts, budgets, costs
      - contact: Email addresses, phone numbers
      - date: Dates and date ranges
      - time: Times and time ranges

      Text to analyze: "${text}"

      Return only the JSON array, no additional text.
    `;
  }

  // Generate demo entities for testing when API is not available
  private generateDemoEntities(text: string): Entity[] {
    const demoEntities: Entity[] = [];
    
    // Simple pattern matching for demo purposes
    const patterns: Record<string, RegExp> = {
      person: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      organization: /\b[A-Z][a-z]+ (Corp|Inc|LLC|Company|Organization)\b/g,
      financial: /\$[\d,]+/g,
      date: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|next week|tomorrow|today)\b/gi,
      time: /\b\d{1,2}:\d{2}\s?(AM|PM|am|pm)?\b/g
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const matchIndex = text.indexOf(match);
          demoEntities.push({
            type,
            value: match.trim(),
            confidence: 0.85,
            context: text.substring(Math.max(0, matchIndex - 20), matchIndex + match.length + 20),
            extractedAt: new Date().toISOString(),
            provider: 'demo'
          });
        });
      }
    });

    return demoEntities;
  }

  // Analyze entities for insights
  async analyzeEntities(entities: Entity[]): Promise<EntityAnalysis> {
    const analysis: EntityAnalysis = {
      totalEntities: entities.length,
      entityCounts: {},
      insights: [],
      relationships: []
    };

    // Count entities by type
    entities.forEach(entity => {
      analysis.entityCounts[entity.type] = (analysis.entityCounts[entity.type] || 0) + 1;
    });

    // Generate insights
    const people = entities.filter(e => e.type === 'person');
    const organizations = entities.filter(e => e.type === 'organization');
    const events = entities.filter(e => e.type === 'event');
    const financial = entities.filter(e => e.type === 'financial');

    if (people.length > 0 && organizations.length > 0) {
      analysis.insights.push(`Conversation involves ${people.length} people and ${organizations.length} organizations`);
    }

    if (events.length > 0) {
      analysis.insights.push(`${events.length} events or meetings mentioned`);
    }

    if (financial.length > 0) {
      analysis.insights.push(`${financial.length} financial items discussed`);
    }

    if (entities.length === 0) {
      analysis.insights.push('No entities found in the text');
    } else if (entities.length > 10) {
      analysis.insights.push('Rich conversation with many entities identified');
    }

    return analysis;
  }

  // Store conversation and entities using MCP service with error handling
  async storeConversationAndEntities(
    transcription: string, 
    entities: Entity[], 
    audioDuration: number | null = null
  ): Promise<string> {
    if (!this.mcpService) {
      throw new AppError('MCP service not available', 'database', 503, 'Database service is temporarily unavailable.');
    }

    try {
      // Store conversation using MCP tool with timeout
      console.log('📝 Storing conversation via MCP...');
      const conversationResult = await withTimeout(
        this.mcpService.executeTool('store_conversation', {
          transcription: transcription || '',
          audioDuration: audioDuration || null,
          metadata: {
            provider: this.aiProvider,
            processedAt: new Date().toISOString(),
            entityCount: entities.length
          }
        }),
        timeouts.DATABASE,
        'database'
      );

      if (!conversationResult.success) {
        throw new AppError(`Failed to store conversation: ${conversationResult.error}`, 'database', 500);
      }

      console.log('✅ Conversation stored with ID:', conversationResult.conversationId);

      // Store each entity using MCP tool with individual error handling
      const successfulEntities: number[] = [];
      const failedEntities: number[] = [];

      for (const [index, entity] of entities.entries()) {
        try {
          console.log(`📋 Storing entity via MCP: ${entity.type} - ${entity.value}`);
          const entityResult = await withTimeout(
            this.mcpService.executeTool('store_entity', {
              type: entity.type || 'unknown',
              value: entity.value || '',
              confidence: entity.confidence || 0.8,
              context: entity.context || '',
              conversationId: conversationResult.conversationId,
              metadata: {
                provider: entity.provider || this.aiProvider,
                extractedAt: entity.extractedAt || new Date().toISOString()
              }
            }),
            timeouts.DATABASE,
            'database'
          );

          if (entityResult.success) {
            console.log(`✅ Entity stored: ${entity.type} - ${entity.value} (ID: ${entityResult.entityId})`);
            successfulEntities.push(index);
          } else {
            console.error(`❌ Failed to store entity: ${entityResult.error}`);
            failedEntities.push(index);
          }
        } catch (entityError) {
          console.error('Error storing entity via MCP:', entityError);
          failedEntities.push(index);
        }
      }

      if (failedEntities.length > 0) {
        console.warn(`⚠️ ${failedEntities.length} entities failed to store, ${successfulEntities.length} succeeded`);
      }

      return conversationResult.conversationId;
    } catch (error) {
      console.error('Error storing via MCP service:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to store data', 'database', 500, 'Unable to save your data. Please try again.');
    }
  }

  // Process voice input end-to-end with comprehensive error handling
  async processVoiceInput(audioBuffer: Buffer): Promise<ProcessingResult> {
    try {
      // Step 1: Transcribe audio
      console.log('🎵 Starting voice input processing...');
      const transcription = await this.transcribe(audioBuffer);
      
      // Step 2: Extract entities
      console.log('🔍 Extracting entities from transcription...');
      const entities = await this.extractEntities(transcription);
      
      // Step 3: Analyze entities
      console.log('📊 Analyzing extracted entities...');
      const analysis = await this.analyzeEntities(entities);

      // Step 4: Store in database
      console.log('💾 Storing results in database...');
      const conversationId = await this.storeConversationAndEntities(
        transcription, 
        entities,
        audioBuffer ? audioBuffer.length / 16000 : null // Rough audio duration estimate
      );

      console.log('✅ Voice input processing completed successfully');

      return {
        transcription,
        entities,
        analysis,
        conversationId,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Voice processing failed', 'general', 500, 'Failed to process your voice input. Please try again.');
    }
  }

  // Process text input end-to-end with error handling
  async processTextInput(text: string): Promise<Omit<ProcessingResult, 'transcription'>> {
    try {
      // Step 1: Extract entities
      console.log('🔍 Processing text input for entity extraction...');
      const entities = await this.extractEntities(text);
      
      // Step 2: Analyze entities
      console.log('📊 Analyzing extracted entities...');
      const analysis = await this.analyzeEntities(entities);

      // Step 3: Store in database
      console.log('💾 Storing results in database...');
      const conversationId = await this.storeConversationAndEntities(text, entities);

      console.log('✅ Text input processing completed successfully');

      return {
        entities,
        analysis,
        conversationId,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Text processing error:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Text processing failed', 'general', 500, 'Failed to process your text input. Please try again.');
    }
  }
}