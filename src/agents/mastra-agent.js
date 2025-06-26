import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';

export class MastraAgent {
  constructor() {
    this.openai = null;
    this.mistral = null;
    this.aiProvider = process.env.AI_PROVIDER || 'openai';
    
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
      'person', 'organization', 'location', 'event', 
      'product', 'financial', 'contact', 'date', 'time'
    ];
  }

  async initialize() {
    const availableProviders = [];
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
  setAiProvider(provider) {
    const validProviders = ['openai', 'mistral', 'demo'];
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
  getAvailableProviders() {
    const providers = ['demo'];
    if (this.openai) providers.push('openai');
    if (this.mistral) providers.push('mistral');
    return providers;
  }

  // Get current provider status
  getProviderStatus() {
    return {
      current: this.aiProvider,
      available: this.getAvailableProviders(),
      openaiAvailable: !!this.openai,
      mistralAvailable: !!this.mistral
    };
  }

  // Transcribe audio using available AI provider
  async transcribe(audioBuffer) {
    if (this.aiProvider === 'demo' || (!this.openai && !this.mistral)) {
      // Fallback for demo purposes when no API key
      return 'Demo transcription: We need to schedule a meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the new product launch budget of $50,000.';
    }

    try {
      let transcription;
      
      if (this.aiProvider === 'openai' && this.openai) {
        transcription = await this.transcribeWithOpenAI(audioBuffer);
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        // Mistral doesn't have audio transcription, fallback to demo
        transcription = "Demo transcription: Mistral AI doesn't support audio transcription yet. Using sample text instead.";
      } else {
        transcription = "Demo transcription: Selected AI provider not available.";
      }

      return transcription;
    } catch (error) {
      console.error(`Transcription error with ${this.aiProvider}:`, error);
      // Fallback for demo purposes
      return 'Sample transcription: We need to schedule a meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the new product launch budget of $50,000.';
    }
  }

  // OpenAI-specific transcription
  async transcribeWithOpenAI(audioBuffer) {
    console.log('🎤 Attempting OpenAI Whisper transcription...');
    console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
    
    try {
      // For Node.js with OpenAI client, we need to create a File-like object
      // Use the proper method for Node.js environment
      
      // Method 1: Try using the toFile helper from OpenAI
      const fs = await import('fs');
      const path = await import('path');
      
      // Write buffer to temporary file
      const tempPath = path.join('/tmp', `audio_${Date.now()}.wav`);
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
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError.message);
      }

      console.log('✅ Whisper transcription successful:', response);
      return response;
    } catch (error) {
      console.error('❌ Whisper API error details:', {
        message: error.message,
        status: error.status,
        type: error.type
      });
      
      throw error;
    }
  }

  // Extract entities from text using AI provider
  async extractEntities(text) {
    if (this.aiProvider === 'demo' || (!this.openai && !this.mistral)) {
      return this.generateDemoEntities(text);
    }

    try {
      let entities;
      
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
        context: entity.context || text.substring(0, 100),
        extractedAt: new Date().toISOString(),
        provider: this.aiProvider
      }));

    } catch (error) {
      console.error(`Entity extraction error with ${this.aiProvider}:`, error);
      // Fallback to demo entities
      return this.generateDemoEntities(text);
    }
  }

  // OpenAI-specific entity extraction
  async extractWithOpenAI(text) {
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

    const extractedText = response.choices[0].message.content.trim();
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
  async extractWithMistral(text) {
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

    const extractedText = response.choices[0].message.content.trim();
    
    try {
      return JSON.parse(extractedText);
    } catch (parseError) {
      console.error('Mistral JSON parse error:', parseError);
      return this.generateDemoEntities(text);
    }
  }

  // Common prompt for entity extraction
  getEntityExtractionPrompt(text) {
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
  generateDemoEntities(text) {
    const demoEntities = [];
    
    // Simple pattern matching for demo purposes
    const patterns = {
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
          demoEntities.push({
            type,
            value: match.trim(),
            confidence: 0.85,
            context: text.substring(Math.max(0, text.indexOf(match) - 20), text.indexOf(match) + match.length + 20),
            extractedAt: new Date().toISOString()
          });
        });
      }
    });

    return demoEntities;
  }

  // Analyze entities for insights
  async analyzeEntities(entities) {
    const analysis = {
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

    if (people.length > 0 && organizations.length > 0) {
      analysis.insights.push(`Conversation involves ${people.length} people and ${organizations.length} organizations`);
    }

    if (events.length > 0) {
      analysis.insights.push(`${events.length} events or meetings mentioned`);
    }

    return analysis;
  }

  // Process voice input end-to-end
  async processVoiceInput(audioBuffer) {
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
} 