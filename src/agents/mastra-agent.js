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
    // For this prototype, we'll simulate transcription
    // In a real implementation, you'd use OpenAI's Whisper API
    const response = await this.openai.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1',
      language: 'en'
    });

    return response.text;
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
    const prompt = this.getEntityExtractionPrompt(text);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use more cost-effective model
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
      max_tokens: 1000
    });

    const extractedText = response.choices[0].message.content.trim();
    
    try {
      return JSON.parse(extractedText);
    } catch (parseError) {
      console.error('OpenAI JSON parse error:', parseError);
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