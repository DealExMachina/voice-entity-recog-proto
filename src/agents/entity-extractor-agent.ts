import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import type { 
  AIProvider, 
  ExtractedEntity, 
  EntityType 
} from '../types/index.js';

interface EntityAnalysis {
  totalEntities: number;
  entityCounts: Record<string, number>;
  insights: string[];
  relationships: string[];
}

export class EntityExtractorAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: AIProvider;
  private readonly entityTypes: EntityType[];

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    
    // Define entity types to extract
    this.entityTypes = ['financial', 'date', 'organization', 'person', 'location', 'product', 'contact'];
    
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
  }

  async initialize(): Promise<boolean> {
    console.log('🔍 Entity Extractor Agent initializing...');
    
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    if (this.mistral) availableProviders.push('Mistral');
    
    if (availableProviders.length > 0) {
      console.log(`🔍 Entity Extractor Agent initialized with: ${availableProviders.join(', ')}`);
    } else {
      console.log('🔍 Entity Extractor Agent initialized with demo mode');
    }
    
    return true;
  }

  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      if (this.aiProvider === 'openai' && this.openai) {
        return await this.extractWithOpenAI(text);
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        return await this.extractWithMistral(text);
      } else {
        return this.generateDemoEntities(text);
      }
    } catch (error) {
      console.error('Entity extraction error:', error);
      // Fallback to demo entities on error
      return this.generateDemoEntities(text);
    }
  }

  private async extractWithOpenAI(text: string): Promise<ExtractedEntity[]> {
    try {
      const prompt = this.getEntityExtractionPrompt(text);
      
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert entity extraction system. Extract entities from text and respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('No valid response from OpenAI');
      }

      // Parse the JSON response
      const parsed = JSON.parse(responseContent);
      const entities = parsed.entities || [];

      return entities.map((entity: any) => ({
        type: entity.type as EntityType,
        value: entity.value,
        confidence: entity.confidence || 0.8,
        context: entity.context || text.substring(0, 100)
      }));

    } catch (error) {
      console.error('OpenAI entity extraction error:', error);
      throw error;
    }
  }

  private async extractWithMistral(text: string): Promise<ExtractedEntity[]> {
    try {
      const prompt = this.getEntityExtractionPrompt(text);
      
      const response = await this.mistral!.chat.complete({
        model: 'mistral-tiny',
        messages: [
          {
            role: 'system',
            content: 'You are an expert entity extraction system. Extract entities from text and respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('No valid response from Mistral');
      }

      // Parse the JSON response
      const parsed = JSON.parse(responseContent);
      const entities = parsed.entities || [];

      return entities.map((entity: any) => ({
        type: entity.type as EntityType,
        value: entity.value,
        confidence: entity.confidence || 0.8,
        context: entity.context || text.substring(0, 100)
      }));

    } catch (error) {
      console.error('Mistral entity extraction error:', error);
      throw error;
    }
  }

  private getEntityExtractionPrompt(text: string): string {
    return `
Extract entities from the following text. Identify entities of these types:
- financial: monetary amounts, currencies, financial instruments
- date: dates, times, temporal expressions
- organization: companies, institutions, groups
- person: names of people
- location: places, addresses, geographical locations
- product: products, services, brands
- contact: emails, phone numbers, social media handles

Text: "${text}"

Respond with valid JSON in this exact format:
{
  "entities": [
    {
      "type": "entity_type_here",
      "value": "entity_value_here",
      "confidence": 0.9,
      "context": "surrounding_context_here"
    }
  ]
}

Only extract entities that are clearly present in the text. Provide confidence scores between 0.1 and 1.0.
`.trim();
  }

  private generateDemoEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const words = text.toLowerCase().split(/\s+/);

    // Simple pattern matching for demo purposes
    const patterns = {
      person: ['john', 'jane', 'smith', 'doe', 'alex', 'sarah', 'mike', 'lisa'],
      organization: ['google', 'microsoft', 'apple', 'company', 'corp', 'inc', 'llc'],
      location: ['new york', 'california', 'london', 'paris', 'tokyo', 'street', 'avenue'],
      financial: ['$', 'dollar', 'euro', 'price', 'cost', 'budget', 'revenue'],
      contact: ['@', '.com', '.org', 'email', 'phone', 'tel'],
      product: ['iphone', 'macbook', 'windows', 'software', 'app', 'service']
    };

    // Look for patterns in the text
    for (const [entityType, patternWords] of Object.entries(patterns)) {
      for (const pattern of patternWords) {
        if (text.toLowerCase().includes(pattern)) {
          entities.push({
            type: entityType as EntityType,
            value: pattern,
            confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9
            context: text.substring(0, 50) + '...'
          });
        }
      }
    }

    // Add date entities if numbers that look like dates are found
    const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
    const dateMatches = text.match(datePattern);
    if (dateMatches) {
      dateMatches.forEach(date => {
        entities.push({
          type: 'date',
          value: date,
          confidence: 0.8,
          context: text.substring(0, 50) + '...'
        });
      });
    }

    return entities.slice(0, 10); // Limit to 10 entities for demo
  }

  async analyzeEntities(entities: ExtractedEntity[]): Promise<EntityAnalysis> {
    const entityCounts: Record<string, number> = {};
    const insights: string[] = [];
    const relationships: string[] = [];

    // Count entities by type
    entities.forEach(entity => {
      entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
    });

    // Generate insights
    const totalEntities = entities.length;
    insights.push(`Found ${totalEntities} entities in total`);

    if (entityCounts.person && entityCounts.organization) {
      insights.push('Text contains both people and organizations, suggesting business context');
    }

    if (entityCounts.financial) {
      insights.push('Financial entities detected, indicating monetary discussion');
    }

    if (entityCounts.location) {
      insights.push('Geographic references found');
    }

    // Generate relationship insights
    const personCount = entityCounts.person || 0;
    const orgCount = entityCounts.organization || 0;
    
    if (personCount > 1) {
      relationships.push('Multiple people mentioned - potential meeting or collaboration');
    }
    
    if (orgCount > 1) {
      relationships.push('Multiple organizations referenced - possible partnership or comparison');
    }

    return {
      totalEntities,
      entityCounts,
      insights,
      relationships
    };
  }

  getCapabilities(): string[] {
    return ['entity-extraction', 'nlp', 'text-analysis'];
  }

  getEntityTypes(): EntityType[] {
    return this.entityTypes;
  }

  getProvider(): AIProvider {
    return this.aiProvider;
  }

  isAvailable(): boolean {
    return this.aiProvider === 'demo' || 
           (this.aiProvider === 'openai' && this.openai !== null) ||
           (this.aiProvider === 'mistral' && this.mistral !== null);
  }
}