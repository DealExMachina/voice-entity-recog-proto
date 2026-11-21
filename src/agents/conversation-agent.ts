import OpenAI from 'openai';
import { SalesAgent } from './sales-agent.js';
import type { 
  AIProvider, 
  ExtractedEntity, 
  ConversationalResponse,
  SalesAnalysis
} from '../types/index.js';
import { getSalesInteractionsByConversation } from '../database/duckdb.js';

interface ConversationContext {
  conversationId: string;
  transcription: string;
  entities: ExtractedEntity[];
  previousInteractions: string[];
  sessionHistory: SessionMessage[];
}

interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  analysis?: SalesAnalysis;
}

interface ConversationState {
  conversationId: string;
  sessionHistory: SessionMessage[];
  activeOpportunityId?: string;
  contextualMemory: Record<string, unknown>;
  lastInteractionTime: string;
}

export class ConversationAgent {
  private openai: OpenAI | null = null;
  private salesAgent: SalesAgent;
  private aiProvider: AIProvider;
  private conversationStates: Map<string, ConversationState> = new Map();

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    this.salesAgent = new SalesAgent();
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async initialize(): Promise<boolean> {
    await this.salesAgent.initialize();
    
    if (this.openai) {
      console.log('🗣️ Conversation agent initialized with OpenAI TTS');
    } else {
      console.log('🗣️ Conversation agent initialized in demo mode');
    }
    return true;
  }

  // Main conversation processing method
  async processConversation(context: ConversationContext): Promise<ConversationalResponse> {
    console.log('🗣️ Processing conversation for sales opportunity analysis...');
    
    try {
      // Update conversation state
      await this.updateConversationState(context);
      
      // Get sales analysis
      const salesContext = {
        transcription: context.transcription,
        entities: context.entities,
        conversationId: context.conversationId,
        previousInteractions: context.previousInteractions
      };
      
      const analysis = await this.salesAgent.analyzeSalesOpportunity(salesContext);
      console.log('📊 Sales analysis completed:', { 
        opportunity_detected: analysis.opportunity_detected,
        confidence: analysis.confidence 
      });
      
      // Generate conversational response
      const response = await this.salesAgent.generateConversationalResponse(analysis, salesContext);
      
      // Add TTS audio if available
      if (response.response_text) {
        const audioBuffer = await this.generateSpeech(response.response_text);
        if (audioBuffer) {
          response.audio_response = audioBuffer;
        }
      }
      
      // Update session history
      await this.addToSessionHistory(context.conversationId, {
        role: 'user',
        content: context.transcription,
        timestamp: new Date().toISOString()
      });
      
      await this.addToSessionHistory(context.conversationId, {
        role: 'assistant',
        content: response.response_text,
        timestamp: new Date().toISOString(),
        analysis
      });
      
      // Create opportunity if detected and doesn't exist
      if (analysis.opportunity_detected && !response.opportunity_match?.matched) {
        const opportunityId = await this.salesAgent.createOpportunityFromAnalysis(analysis, context.conversationId);
        if (opportunityId) {
          const state = this.conversationStates.get(context.conversationId);
          if (state) {
            state.activeOpportunityId = opportunityId;
          }
        }
      }
      
      console.log('✅ Conversation processed successfully');
      return response;
      
    } catch (error) {
      console.error('❌ Error processing conversation:', error);
      return this.generateFallbackResponse(context);
    }
  }

  // Generate text-to-speech audio
  async generateSpeech(text: string): Promise<Buffer | undefined> {
    if (this.aiProvider === 'demo' || !this.openai) {
      console.log('🔊 TTS: Demo mode - no audio generated');
      return undefined;
    }

    try {
      console.log('🔊 Generating TTS audio...');
      
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova', // Professional, clear voice
        input: text,
        response_format: 'mp3'
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`✅ TTS audio generated: ${audioBuffer.length} bytes`);
      return audioBuffer;
      
    } catch (error) {
      console.error('❌ TTS generation error:', error);
      return undefined;
    }
  }

  // Get conversation history and context
  async getConversationHistory(conversationId: string): Promise<SessionMessage[]> {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      return state.sessionHistory;
    }

    // Load from database if not in memory
    try {
      const interactions = await getSalesInteractionsByConversation(conversationId);
      const history: SessionMessage[] = [];
      
      for (const interaction of interactions) {
        // Add assistant messages from database
        history.push({
          role: 'assistant',
          content: interaction.agent_response,
          timestamp: interaction.created_at || new Date().toISOString(),
          analysis: interaction.agent_analysis ? JSON.parse(interaction.agent_analysis) : undefined
        });
      }
      
      return history;
    } catch (error) {
      console.error('Error loading conversation history:', error);
      return [];
    }
  }

  // Update contextual memory for ongoing conversations
  private async updateConversationState(context: ConversationContext): Promise<void> {
    const existing = this.conversationStates.get(context.conversationId);
    
    if (existing) {
      existing.lastInteractionTime = new Date().toISOString();
      existing.sessionHistory.push(...context.sessionHistory);
    } else {
      this.conversationStates.set(context.conversationId, {
        conversationId: context.conversationId,
        sessionHistory: [...context.sessionHistory],
        contextualMemory: {},
        lastInteractionTime: new Date().toISOString()
      });
    }
  }

  // Add message to session history
  private async addToSessionHistory(conversationId: string, message: SessionMessage): Promise<void> {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.sessionHistory.push(message);
      
      // Keep only last 20 messages to prevent memory bloat
      if (state.sessionHistory.length > 20) {
        state.sessionHistory = state.sessionHistory.slice(-20);
      }
    }
  }

  // Generate contextual follow-up questions
  async generateFollowUpQuestions(
    analysis: SalesAnalysis,
    conversationHistory: SessionMessage[]
  ): Promise<string[]> {
    if (this.aiProvider === 'demo' || !this.openai) {
      return this.generateDemoFollowUpQuestions(analysis);
    }

    try {
      const systemPrompt = `You are a sales conversation expert. Based on the sales analysis and conversation history, generate 2-3 strategic follow-up questions that will help qualify the opportunity and move the conversation forward.

Questions should:
1. Address missing information from the analysis
2. Not repeat questions already asked in the conversation
3. Be natural and conversational
4. Help qualify timeline, budget, decision process, or pain points

Return only the questions as a JSON array of strings.`;

      const userPrompt = `
SALES ANALYSIS:
${JSON.stringify(analysis, null, 2)}

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Generate 2-3 strategic follow-up questions.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed.questions) ? parsed.questions : [];
      }
      
      return this.generateDemoFollowUpQuestions(analysis);
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return this.generateDemoFollowUpQuestions(analysis);
    }
  }

  // Get conversation insights and recommendations
  async getConversationInsights(conversationId: string): Promise<{
    summary: string;
    key_insights: string[];
    recommendations: string[];
    opportunity_status: string;
  }> {
    const history = await this.getConversationHistory(conversationId);
    const state = this.conversationStates.get(conversationId);
    
    if (this.aiProvider === 'demo' || !this.openai) {
      return this.generateDemoInsights(history);
    }

    try {
      const systemPrompt = `You are a sales conversation analyst. Analyze the conversation history and provide insights and recommendations.

Return a JSON object with:
- summary: Brief conversation summary (2-3 sentences)
- key_insights: Array of important insights discovered
- recommendations: Array of next steps or recommendations
- opportunity_status: One of "hot", "warm", "cold", "qualified", "unqualified"`;

      const conversationText = history
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this conversation:\n\n${conversationText}` }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
      
      return this.generateDemoInsights(history);
    } catch (error) {
      console.error('Error generating conversation insights:', error);
      return this.generateDemoInsights(history);
    }
  }

  // Cleanup old conversation states (memory management)
  private cleanupOldStates(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [conversationId, state] of this.conversationStates) {
      const lastInteraction = new Date(state.lastInteractionTime).getTime();
      if (lastInteraction < cutoffTime) {
        this.conversationStates.delete(conversationId);
      }
    }
  }

  // Fallback response for errors
  private generateFallbackResponse(context: ConversationContext): ConversationalResponse {
    return {
      analysis: {
        opportunity_detected: false,
        confidence: 0.1,
        key_insights: ['Unable to analyze conversation'],
        missing_information: ['Complete conversation analysis'],
        suggested_questions: ['Could you repeat that?', 'What would you like to discuss?'],
        risk_factors: ['Technical issues with analysis'],
        next_actions: ['Retry conversation processing']
      },
      response_text: "I apologize, but I'm having trouble processing that right now. Could you tell me more about what you'd like to discuss?",
      follow_up_questions: ['What can I help you with today?'],
      suggested_actions: ['Restart conversation'],
      opportunity_match: { matched: false }
    };
  }

  // Demo implementations
  private generateDemoFollowUpQuestions(analysis: SalesAnalysis): string[] {
    if (analysis.opportunity_detected) {
      return [
        'What timeline are you working with for this decision?',
        'Who else is involved in the evaluation process?',
        'What challenges are you trying to solve?'
      ];
    } else {
      return [
        'What are your biggest business priorities right now?',
        'How are you currently handling this process?'
      ];
    }
  }

  private generateDemoInsights(history: SessionMessage[]): {
    summary: string;
    key_insights: string[];
    recommendations: string[];
    opportunity_status: string;
  } {
    return {
      summary: `Conversation contains ${history.length} exchanges with potential business interest.`,
      key_insights: [
        'Demo mode - limited analysis available',
        'Basic conversation tracking active'
      ],
      recommendations: [
        'Enable full analysis with API keys',
        'Continue gathering information'
      ],
      opportunity_status: 'warm'
    };
  }

  // Periodic cleanup (should be called by a scheduler)
  public startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldStates();
    }, 60 * 60 * 1000); // Every hour
  }
} 