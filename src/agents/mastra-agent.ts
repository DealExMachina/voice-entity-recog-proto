import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import type { 
  AIProvider, 
  EntityType, 
  ExtractedEntity, 
  TranscriptionResponse,
  EntityExtractionResponse 
} from '../types/index.js';

interface ProviderStatus {
  current: AIProvider;
  available: AIProvider[];
  openaiAvailable: boolean;
  mistralAvailable: boolean;
}

interface EntityAnalysis {
  totalEntities: number;
  entityCounts: Record<string, number>;
  insights: string[];
  relationships: string[];
}

interface VoiceProcessingResult {
  transcription: string;
  entities: ExtractedEntity[];
  analysis: EntityAnalysis;
  processedAt: string;
}

export class MastraAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: AIProvider;
  private readonly entityTypes: EntityType[];

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    // Initialize Mistral if API key is available
    if (process.env.MISTRAL_API_KEY) {
      this.mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY
      });
    }
    
    this.entityTypes = [
      'person', 'organization', 'location', 'financial', 
      'product', 'contact', 'date'
    ];
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

  // Method to switch AI provider
  setAiProvider(provider: AIProvider): void {
    const validProviders: AIProvider[] = ['openai', 'mistral', 'demo'];
    if (!validProviders.includes(provider)) {
      throw new Error(`Invalid AI provider: ${provider}. Valid options: ${validProviders.join(', ')}`);
    }
    
    if (provider === 'openai' && !this.openai) {
      throw new Error('OpenAI not available - missing API key');
    }
    
    if (provider === 'mistral' && !this.mistral) {
      throw new Error('Mistral not available - missing API key');
    }
    
    this.aiProvider = provider;
    console.log(`🔄 Switched AI provider to: ${provider.toUpperCase()}`);
  }

  // Get available providers
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = ['demo'];
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

  // Transcribe audio using AI provider
  async transcribe(audioBuffer: Buffer): Promise<string> {
    console.log('🎤 Transcribe called with buffer size:', audioBuffer?.length || 'undefined', 'bytes');
    console.log('📊 Current AI provider:', this.aiProvider);
    console.log('🔑 OpenAI available:', !!this.openai);
    console.log('🔑 Mistral available:', !!this.mistral);

    try {
      let transcription: string;
      
      if (this.aiProvider === 'openai' && this.openai) {
        console.log('🚀 Attempting OpenAI transcription...');
        transcription = await this.transcribeWithOpenAI(audioBuffer);
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        // Mistral doesn't have audio transcription, fallback to demo
        console.log('⚠️ Mistral doesn\'t support audio transcription, using demo mode');
        transcription = "Demo transcription: Mistral AI doesn't support audio transcription yet. Using sample text instead.";
      } else {
        console.log('⚠️ No suitable AI provider available, using demo mode');
        transcription = "Demo transcription: Selected AI provider not available.";
      }

      return transcription;
    } catch (error) {
      console.error(`❌ Transcription error with ${this.aiProvider}:`, error);
      console.error('📝 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      // Fallback for demo purposes
      console.log('🔄 Falling back to demo transcription');
      return 'Sample transcription: We need to schedule a meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the new product launch budget of $50,000.';
    }
  }

  // OpenAI-specific transcription
  private async transcribeWithOpenAI(audioBuffer: Buffer): Promise<string> {
    console.log('🎤 Attempting OpenAI Whisper transcription...');
    console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
    
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer provided');
    }
    
    try {
      // Detect if this is actually audio data by checking the buffer header
      const isValidWebM = this.isValidWebMBuffer(audioBuffer);
      const fileExtension = isValidWebM ? '.webm' : '.wav'; // Fallback to wav for other data
      
      console.log('🔍 Audio format detection:', { isValidWebM, fileExtension, bufferStart: audioBuffer.slice(0, 8).toString('hex') });
      
      const tempPath = path.join('/tmp', `audio_${Date.now()}${fileExtension}`);
      await fs.promises.writeFile(tempPath, audioBuffer);
      
      console.log('📤 Sending audio file to OpenAI Whisper API...', { path: tempPath, size: audioBuffer.length });
      
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        response_format: 'text',
        language: 'en' // Specify language for better accuracy
      });
      
      // Clean up temp file
      await fs.promises.unlink(tempPath).catch(() => {}); // Ignore cleanup errors
      
      console.log('✅ Whisper transcription successful:', response.substring(0, 100) + '...');
      return response as string;
      
    } catch (error: any) {
      console.log('❌ Whisper API error details:', {
        message: error.message,
        status: error.status,
        type: error.type
      });
      
      // Clean up temp file on error
      const tempFiles = await fs.promises.readdir('/tmp').catch(() => []);
      const audioFiles = tempFiles.filter(f => f.startsWith('audio_') && f.includes(Date.now().toString().slice(0, -3)));
      for (const file of audioFiles) {
        await fs.promises.unlink(path.join('/tmp', file)).catch(() => {});
      }
      
      throw error;
    }
  }

  // Check if buffer contains valid WebM data
  private isValidWebMBuffer(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    
    // WebM files start with specific byte patterns
    // EBML header: 0x1A 0x45 0xDF 0xA3
    const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
    
    // Check if buffer starts with WebM/EBML signature
    return buffer.slice(0, 4).equals(webmHeader);
  }

  // Extract entities from text using AI provider
  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    if (this.aiProvider === 'demo' || (!this.openai && !this.mistral)) {
      return this.generateDemoEntities(text);
    }

    try {
      let entities: ExtractedEntity[];
      
      if (this.aiProvider === 'openai' && this.openai) {
        entities = await this.extractWithOpenAI(text);
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        entities = await this.extractWithMistral(text);
      } else {
        // Fallback to demo if current provider not available
        entities = this.generateDemoEntities(text);
      }

      // Add metadata and validate
      return entities.map(entity => ({
        ...entity,
        confidence: entity.confidence || 0.8,
        context: entity.context || text.substring(0, 100)
      }));

    } catch (error) {
      console.error(`Entity extraction error with ${this.aiProvider}:`, error);
      // Fallback to demo entities
      return this.generateDemoEntities(text);
    }
  }

  // OpenAI-specific entity extraction
  private async extractWithOpenAI(text: string): Promise<ExtractedEntity[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
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
- product: Specific products, services, or projects
- financial: Monetary amounts, budgets, costs, revenue
- contact: Email addresses, phone numbers
- date: Specific dates, days of week, relative dates

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
      throw new Error('No response from OpenAI');
    }
    
    console.log('📥 OpenAI response:', extractedText);
    
    try {
      const parsed = JSON.parse(extractedText);
      // If it's wrapped in an object, extract the array
      return Array.isArray(parsed) ? parsed : (parsed.entities || []);
    } catch (parseError) {
      console.error('OpenAI JSON parse error:', parseError, 'Raw response:', extractedText);
      return this.generateDemoEntities(text);
    }
  }

  // Mistral-specific entity extraction
  private async extractWithMistral(text: string): Promise<ExtractedEntity[]> {
    if (!this.mistral) {
      throw new Error('Mistral client not initialized');
    }

    const prompt = this.getEntityExtractionPrompt(text);

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

    const content = response.choices[0]?.message?.content;
    const extractedText = typeof content === 'string' ? content.trim() : '';
    if (!extractedText) {
      throw new Error('No response from Mistral');
    }
    
    try {
      return JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Mistral JSON parse error:', parseError);
      return this.generateDemoEntities(text);
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
      - product: Items, services, features
      - financial: Money amounts, budgets, costs
      - contact: Email addresses, phone numbers
      - date: Dates and date ranges

      Text to analyze: "${text}"

      Return only the JSON array, no additional text.
    `;
  }

  // Generate demo entities for testing when API is not available
  private generateDemoEntities(text: string): ExtractedEntity[] {
    const demoEntities: ExtractedEntity[] = [];
    
    // Simple pattern matching for demo purposes
    const patterns: Record<EntityType, RegExp> = {
      person: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      organization: /\b[A-Z][a-z]+ (Corp|Inc|LLC|Company|Organization)\b/g,
      financial: /\$[\d,]+/g,
      date: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|next week|tomorrow|today)\b/gi,
      location: /\b[A-Z][a-z]+ (City|Street|Avenue|Road)\b/g,
      product: /\b[A-Z][a-z]+ (Product|Service|Platform)\b/g,
      contact: /\b[\w.-]+@[\w.-]+\.\w+\b/g
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const startIndex = text.indexOf(match);
          const contextStart = Math.max(0, startIndex - 20);
          const contextEnd = Math.min(text.length, startIndex + match.length + 20);
          
          demoEntities.push({
            type: type as EntityType,
            value: match.trim(),
            confidence: 0.85,
            context: text.substring(contextStart, contextEnd)
          });
        });
      }
    });

    return demoEntities;
  }

  // Analyze entities for insights
  async analyzeEntities(entities: ExtractedEntity[]): Promise<EntityAnalysis> {
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
    const events = entities.filter(e => e.type === 'date');

    if (people.length > 0 && organizations.length > 0) {
      analysis.insights.push(`Conversation involves ${people.length} people and ${organizations.length} organizations`);
    }

    if (events.length > 0) {
      analysis.insights.push(`${events.length} events or meetings mentioned`);
    }

    return analysis;
  }

  // Process voice input end-to-end
  async processVoiceInput(audioBuffer: Buffer): Promise<VoiceProcessingResult> {
    try {
      // Step 1: Transcribe audio
      const transcription = await this.transcribe(audioBuffer);
      
      // Step 2: Extract entities
      const entities = await this.extractEntities(transcription);
      
      // Step 3: Analyze entities
      const analysis = await this.analyzeEntities(entities);

      return {
        transcription,
        entities,
        analysis,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      throw error;
    }
  }

  getEntityTypes(): EntityType[] {
    return this.entityTypes;
  }

  async generateResponse(input: string, personaId?: string): Promise<{
    text: string;
    entities: ExtractedEntity[];
    confidence: number;
    responseTime: number;
    personaUsed: string;
  }> {
    const startTime = Date.now();
    
    try {
      let responseText: string;
      let personaUsed = 'default';
      
      if (this.aiProvider === 'openai' && this.openai) {
        // Get persona context if available
        let personaContext = '';
        if (personaId) {
          // In a real implementation, you'd fetch persona details from database
          personaContext = `You are a helpful AI assistant. Respond in a conversational manner.`;
        }
        
        const prompt = `${personaContext}\n\nUser: ${input}\n\nAssistant:`;
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: personaContext || 'You are a helpful AI assistant. Respond naturally and conversationally.'
            },
            {
              role: 'user',
              content: input
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        });
        
        responseText = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
        personaUsed = personaId || 'openai-default';
        
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        // Mistral implementation - using demo mode for now
        responseText = `Thank you for your message: "${input}". This is a Mistral AI demo response. In a real implementation, I would provide a more detailed and contextual reply.`;
        personaUsed = personaId || 'mistral-default';
        
      } else {
        // Demo mode
        responseText = `Thank you for your message: "${input}". This is a demo response. In a real implementation, I would provide a more detailed and contextual reply based on your input and any configured persona.`;
        personaUsed = personaId || 'demo-default';
      }
      
      // Extract entities from the response
      const entities = await this.extractEntities(responseText);
      
      const responseTime = Date.now() - startTime;
      
      return {
        text: responseText,
        entities,
        confidence: 0.9, // High confidence for generated responses
        responseTime,
        personaUsed
      };
      
    } catch (error) {
      console.error('Response generation error:', error);
      const responseTime = Date.now() - startTime;
      
      return {
        text: 'I apologize, but I encountered an error while generating a response. Please try again.',
        entities: [],
        confidence: 0.0,
        responseTime,
        personaUsed: personaId || 'error'
      };
    }
  }
} 