import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import type { 
  AIProvider, 
  ExtractedEntity,
  AgentResponse
} from '../types/index.js';
import { getPersonaById } from '../database/duckdb.js';

interface ConversationContext {
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  entities: ExtractedEntity[];
  userPreferences: Record<string, unknown>;
}

export class ResponseGeneratorAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: AIProvider;
  private conversationHistory: Map<string, ConversationContext> = new Map();

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
  }

  async initialize(): Promise<boolean> {
    console.log('💬 Response Generator Agent initializing...');
    
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    if (this.mistral) availableProviders.push('Mistral');
    
    if (availableProviders.length > 0) {
      console.log(`💬 Response Generator Agent initialized with: ${availableProviders.join(', ')}`);
    } else {
      console.log('💬 Response Generator Agent initialized with demo mode');
    }
    
    return true;
  }

  async generateResponse(input: string, personaId?: string, sessionId?: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      let responseText: string;
      let personaUsed = 'default';
      let entities: ExtractedEntity[] = [];
      
      // Get conversation context if session ID provided
      const context = sessionId ? this.conversationHistory.get(sessionId) : undefined;
      
      if (this.aiProvider === 'openai' && this.openai) {
        const result = await this.generateWithOpenAI(input, personaId, context);
        responseText = result.text;
        personaUsed = result.personaUsed;
        entities = result.entities;
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        const result = await this.generateWithMistral(input, personaId, context);
        responseText = result.text;
        personaUsed = result.personaUsed;
        entities = result.entities;
      } else {
        const result = this.generateDemoResponse(input, personaId);
        responseText = result.text;
        personaUsed = result.personaUsed;
        entities = result.entities;
      }
      
      // Update conversation history
      if (sessionId) {
        this.updateConversationHistory(sessionId, input, responseText, entities);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        text: responseText,
        entities,
        confidence: 0.9,
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

  private async generateWithOpenAI(
    input: string, 
    personaId?: string, 
    context?: ConversationContext
  ): Promise<{ text: string; personaUsed: string; entities: ExtractedEntity[] }> {
    try {
      // Get persona context if available
      let personaContext = '';
      let personaUsed = 'openai-default';
      
      if (personaId) {
        try {
          const persona = await getPersonaById(personaId);
                     if (persona) {
             personaContext = this.buildPersonaPrompt(persona);
             personaUsed = persona.name || 'persona-unknown';
           }
        } catch (error) {
          console.warn('Failed to load persona:', error);
        }
      }
      
      // Build conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system message with persona
      messages.push({
        role: 'system',
        content: personaContext || 'You are a helpful AI assistant. Respond naturally and conversationally.'
      });
      
      // Add conversation history if available
      if (context?.previousMessages) {
        context.previousMessages.slice(-5).forEach(msg => { // Last 5 messages
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          });
        });
      }
      
      // Add current user input
      messages.push({
        role: 'user',
        content: input
      });
      
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7
      });
      
      const responseText = completion.choices[0]?.message?.content || 
        'I apologize, but I couldn\'t generate a response.';
      
      return {
        text: responseText,
        personaUsed,
        entities: [] // Will be extracted separately by EntityExtractorAgent
      };
      
    } catch (error) {
      console.error('OpenAI response generation error:', error);
      throw error;
    }
  }

  private async generateWithMistral(
    input: string, 
    personaId?: string, 
    context?: ConversationContext
  ): Promise<{ text: string; personaUsed: string; entities: ExtractedEntity[] }> {
    try {
      // Build messages array
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      
      // Add system message
      let systemPrompt = 'You are a helpful AI assistant. Respond naturally and conversationally.';
      if (personaId) {
        try {
          const persona = await getPersonaById(personaId);
          if (persona) {
            systemPrompt = this.buildPersonaPrompt(persona);
          }
        } catch (error) {
          console.warn('Failed to load persona:', error);
        }
      }
      
      messages.push({
        role: 'system',
        content: systemPrompt
      });
      
      // Add conversation history if available
      if (context?.previousMessages) {
        context.previousMessages.slice(-3).forEach(msg => { // Last 3 messages for Mistral
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          });
        });
      }
      
      // Add current user input
      messages.push({
        role: 'user',
        content: input
      });
      
      const response = await this.mistral!.chat.complete({
        model: 'mistral-tiny',
        messages,
        max_tokens: 400,
        temperature: 0.7
      });
      
      const responseContent = response.choices[0]?.message?.content;
      const responseText = (typeof responseContent === 'string' && responseContent) ? responseContent : 
        'I apologize, but I couldn\'t generate a response.';
      
      return {
        text: responseText,
        personaUsed: personaId || 'mistral-default',
        entities: []
      };
      
    } catch (error) {
      console.error('Mistral response generation error:', error);
      throw error;
    }
  }

  private generateDemoResponse(
    input: string, 
    personaId?: string
  ): { text: string; personaUsed: string; entities: ExtractedEntity[] } {
    const demoResponses = [
      `Thank you for your message: "${input}". This is a demo response from the Response Generator Agent.`,
      `I understand you said: "${input}". In a real implementation, I would provide a more contextual reply.`,
      `Your input "${input}" has been processed. This demonstrates the response generation capabilities.`,
      `Responding to: "${input}". The system is working in demo mode with simulated AI responses.`,
      `Message received: "${input}". This is an example of how the agent would respond in production.`
    ];
    
    const responseIndex = Math.abs(input.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % demoResponses.length;
    const responseText = demoResponses[responseIndex];
    
    return {
      text: responseText,
      personaUsed: personaId || 'demo-default',
      entities: []
    };
  }

  private buildPersonaPrompt(persona: any): string {
    return `
You are ${persona.name}. ${persona.description}

Personality traits: ${persona.personality?.traits?.join(', ') || 'helpful, professional'}
Tone: ${persona.personality?.tone || 'friendly'}
Style: ${persona.personality?.style || 'conversational'}
Response length preference: ${persona.personality?.responseLength || 'medium'}

Expertise areas: ${persona.expertise?.join(', ') || 'general assistance'}

Respond according to this persona while being helpful and informative.
`.trim();
  }

  private updateConversationHistory(
    sessionId: string, 
    userInput: string, 
    assistantResponse: string, 
    entities: ExtractedEntity[]
  ): void {
    let context = this.conversationHistory.get(sessionId);
    
    if (!context) {
      context = {
        previousMessages: [],
        entities: [],
        userPreferences: {}
      };
    }
    
    // Add user message
    context.previousMessages.push({
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    });
    
    // Add assistant response
    context.previousMessages.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date().toISOString()
    });
    
    // Add entities
    context.entities.push(...entities);
    
    // Keep only last 20 messages
    if (context.previousMessages.length > 20) {
      context.previousMessages = context.previousMessages.slice(-20);
    }
    
    // Keep only last 50 entities
    if (context.entities.length > 50) {
      context.entities = context.entities.slice(-50);
    }
    
    this.conversationHistory.set(sessionId, context);
  }

  getConversationHistory(sessionId: string): ConversationContext | undefined {
    return this.conversationHistory.get(sessionId);
  }

  clearConversationHistory(sessionId?: string): void {
    if (sessionId) {
      this.conversationHistory.delete(sessionId);
    } else {
      this.conversationHistory.clear();
    }
  }

  getCapabilities(): string[] {
    return ['conversation', 'response-generation', 'dialogue'];
  }

  getProvider(): AIProvider {
    return this.aiProvider;
  }

  isAvailable(): boolean {
    return this.aiProvider === 'demo' || 
           (this.aiProvider === 'openai' && this.openai !== null) ||
           (this.aiProvider === 'mistral' && this.mistral !== null);
  }

  getActiveSessionsCount(): number {
    return this.conversationHistory.size;
  }
}