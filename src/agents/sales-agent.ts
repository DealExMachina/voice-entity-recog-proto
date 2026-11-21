import OpenAI from 'openai';
import type { 
  AIProvider, 
  ExtractedEntity, 
  SalesAnalysis, 
  OpportunitySummary,
  OpportunityStage,
  Opportunity,
  ConversationalResponse,
  OpportunityMatch
} from '../types/index.js';
import { 
  getOpportunitiesByClient, 
  getActiveOpportunities,
  insertOpportunity,
  updateOpportunity,
  insertSalesInteraction
} from '../database/duckdb.js';

interface SalesContext {
  transcription: string;
  entities: ExtractedEntity[];
  conversationId: string;
  previousInteractions?: string[];
}

export class SalesAgent {
  private openai: OpenAI | null = null;
  private aiProvider: AIProvider;

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async initialize(): Promise<boolean> {
    if (this.openai) {
      console.log('💼 Sales agent initialized with OpenAI');
    } else {
      console.log('💼 Sales agent initialized in demo mode');
    }
    return true;
  }

  // Main method for analyzing sales opportunities
  async analyzeSalesOpportunity(context: SalesContext): Promise<SalesAnalysis> {
    console.log('🔍 Starting sales opportunity analysis...');
    
    if (this.aiProvider === 'demo' || !this.openai) {
      return this.generateDemoAnalysis(context);
    }

    try {
      const analysis = await this.performChainOfThoughtAnalysis(context);
      console.log('✅ Sales analysis completed:', analysis);
      return analysis;
    } catch (error) {
      console.error('❌ Sales analysis error:', error);
      return this.generateDemoAnalysis(context);
    }
  }

  // Chain-of-thought reasoning for sales opportunity identification
  private async performChainOfThoughtAnalysis(context: SalesContext): Promise<SalesAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const systemPrompt = `You are an expert sales opportunity analysis agent with deep experience in B2B sales. Your task is to analyze conversations and identify potential sales opportunities using chain-of-thought reasoning.

ANALYSIS FRAMEWORK:
1. OPPORTUNITY DETECTION: Determine if there's a genuine sales opportunity
2. KEY INSIGHTS: Extract critical business information
3. MISSING INFORMATION: Identify gaps that need clarification
4. RISK ASSESSMENT: Evaluate potential challenges or concerns
5. NEXT ACTIONS: Recommend specific follow-up steps

OPPORTUNITY INDICATORS TO LOOK FOR:
- Budget discussions or financial mentions
- Timeline references (decision dates, deadlines)
- Pain points or business challenges
- Authority figures or decision makers
- Competitive landscape mentions
- Technical requirements or specifications
- Procurement processes or procedures

ENTITY ANALYSIS:
- Person entities: Identify roles, decision-making authority
- Organization entities: Company size, industry, relationships
- Financial entities: Budget ranges, existing spend, value propositions
- Date entities: Timelines, deadlines, decision windows
- Product entities: Solutions, competitive alternatives

OUTPUT FORMAT (JSON):
{
  "opportunity_detected": boolean,
  "confidence": 0.0-1.0,
  "key_insights": ["insight1", "insight2"],
  "missing_information": ["question1", "question2"],
  "suggested_questions": ["question1", "question2"],
  "opportunity_summary": {
    "title": "string",
    "client": "string", 
    "value": number,
    "currency": "string",
    "timeline": "string",
    "probability": 0.0-1.0,
    "stage": "discovery|qualification|proposal|negotiation|closing"
  },
  "risk_factors": ["risk1", "risk2"],
  "next_actions": ["action1", "action2"]
}

Think step by step through your analysis process.`;

    const userPrompt = `
CONVERSATION TRANSCRIPT:
"${context.transcription}"

EXTRACTED ENTITIES:
${JSON.stringify(context.entities, null, 2)}

CONVERSATION ID: ${context.conversationId}

PREVIOUS INTERACTIONS:
${context.previousInteractions?.join('\n') || 'None'}

Please analyze this conversation for sales opportunities using your chain-of-thought framework. Consider the context, entities, and any previous interactions to provide a comprehensive analysis.`;

    console.log('🧠 Performing chain-of-thought analysis...');
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const analysisText = response.choices[0]?.message?.content?.trim();
    if (!analysisText) {
      throw new Error('No analysis response from OpenAI');
    }

    try {
      const analysis = JSON.parse(analysisText) as SalesAnalysis;
      console.log('📊 Analysis result:', {
        opportunity_detected: analysis.opportunity_detected,
        confidence: analysis.confidence,
        insights_count: analysis.key_insights.length,
        questions_count: analysis.suggested_questions.length
      });
      
      return analysis;
    } catch (parseError) {
      console.error('JSON parse error in sales analysis:', parseError);
      return this.generateDemoAnalysis(context);
    }
  }

  // Generate conversational response with follow-up questions
  async generateConversationalResponse(
    analysis: SalesAnalysis, 
    context: SalesContext
  ): Promise<ConversationalResponse> {
    console.log('💬 Generating conversational response...');

    if (this.aiProvider === 'demo' || !this.openai) {
      return this.generateDemoResponse(analysis, context);
    }

    try {
      const opportunityMatch = await this.findOpportunityMatch(analysis, context);
      const responseText = await this.generateResponseText(analysis, context, opportunityMatch);
      
      const response: ConversationalResponse = {
        analysis,
        response_text: responseText,
        follow_up_questions: analysis.suggested_questions.slice(0, 3), // Limit to 3 questions
        suggested_actions: analysis.next_actions,
        opportunity_match: opportunityMatch
      };

      // Store the interaction in the database
      if (context.conversationId) {
        const interactionData: any = {
          conversation_id: context.conversationId,
          agent_analysis: JSON.stringify(analysis),
          agent_response: responseText,
          follow_up_questions: response.follow_up_questions,
          confidence_score: analysis.confidence,
          metadata: {
            entity_count: context.entities.length,
            opportunity_detected: analysis.opportunity_detected,
            generated_at: new Date().toISOString()
          }
        };
        
        if (opportunityMatch?.existing_opportunity?.id) {
          interactionData.opportunity_id = opportunityMatch.existing_opportunity.id;
        }
        
        await insertSalesInteraction(interactionData);
      }

      return response;
    } catch (error) {
      console.error('❌ Error generating conversational response:', error);
      return this.generateDemoResponse(analysis, context);
    }
  }

  // Find or create opportunity matches
  private async findOpportunityMatch(
    analysis: SalesAnalysis, 
    context: SalesContext
  ): Promise<OpportunityMatch> {
    if (!analysis.opportunity_detected || !analysis.opportunity_summary) {
      return { matched: false };
    }

    const clientName = analysis.opportunity_summary.client;
    if (!clientName) {
      return { matched: false };
    }

    try {
      // Search for existing opportunities with the same client
      const existingOpportunities = await getOpportunitiesByClient(clientName);
      
      if (existingOpportunities.length === 0) {
        return { matched: false };
      }

      // Find the best match based on similarity
      const bestMatch = existingOpportunities[0]; // Simple matching for now
      if (!bestMatch) {
        return { matched: false };
      }
      
      const similarity = this.calculateSimilarity(analysis.opportunity_summary, bestMatch);

      return {
        matched: true,
        existing_opportunity: bestMatch,
        similarity_score: similarity,
        merge_recommended: similarity > 0.7,
        differences: similarity < 0.9 ? ['Timeline differences', 'Value discrepancies'] : []
      };
    } catch (error) {
      console.error('Error finding opportunity match:', error);
      return { matched: false };
    }
  }

  // Create new opportunity from analysis
  async createOpportunityFromAnalysis(
    analysis: SalesAnalysis,
    conversationId: string
  ): Promise<string | null> {
    if (!analysis.opportunity_detected || !analysis.opportunity_summary) {
      return null;
    }

    const summary = analysis.opportunity_summary;
    
    try {
      const opportunityData: any = {
        title: summary.title,
        description: `Opportunity identified from conversation analysis`,
        client_organization: summary.client,
        estimated_value: summary.value,
        currency: summary.currency,
        probability: summary.probability,
        stage: summary.stage,
        source_conversation_id: conversationId,
        context_summary: analysis.key_insights.join('; '),
        metadata: {
          analysis_confidence: analysis.confidence,
          risk_factors: analysis.risk_factors,
          created_by: 'sales_agent',
          created_at: new Date().toISOString()
        }
      };
      
      const decisionDate = this.parseDecisionDate(summary.timeline);
      if (decisionDate) {
        opportunityData.decision_date = decisionDate;
      }
      
      const opportunityId = await insertOpportunity(opportunityData);

      console.log(`💼 Created new opportunity: ${opportunityId}`);
      return opportunityId;
    } catch (error) {
      console.error('❌ Failed to create opportunity:', error);
      return null;
    }
  }

  // Generate response text based on analysis
  private async generateResponseText(
    analysis: SalesAnalysis,
    context: SalesContext,
    opportunityMatch?: OpportunityMatch
  ): Promise<string> {
    if (!this.openai) {
      return this.generateDemoResponseText(analysis);
    }

    const systemPrompt = `You are a conversational sales assistant. Generate a natural, professional response based on the sales analysis. Your response should:

1. Acknowledge what was discussed
2. Highlight key insights or opportunities identified
3. Ask 1-2 strategic follow-up questions
4. Be conversational and engaging
5. Show expertise and add value

Keep responses concise (100-200 words) and professional but friendly.`;

    const contextInfo = opportunityMatch?.matched 
      ? `There's an existing opportunity for ${opportunityMatch.existing_opportunity?.client_organization} that might be related.`
      : analysis.opportunity_detected 
        ? 'This appears to be a new sales opportunity.'
        : 'This conversation contains valuable business insights.';

    const userPrompt = `
SALES ANALYSIS:
- Opportunity detected: ${analysis.opportunity_detected}
- Confidence: ${(analysis.confidence * 100).toFixed(1)}%
- Key insights: ${analysis.key_insights.join(', ')}
- Missing info: ${analysis.missing_information.join(', ')}

CONTEXT: ${contextInfo}

Generate a conversational response that acknowledges the discussion and moves the conversation forward strategically.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return response.choices[0]?.message?.content?.trim() || this.generateDemoResponseText(analysis);
  }

  // Helper methods
  private parseDecisionDate(timeline: string): string | undefined {
    // Simple date parsing - could be enhanced with more sophisticated NLP
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
    ];

    for (const pattern of datePatterns) {
      const match = timeline.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  private calculateSimilarity(summary: OpportunitySummary, opportunity: Opportunity): number {
    let score = 0;
    let factors = 0;

    // Client name similarity
    if (summary.client === opportunity.client_organization) {
      score += 0.4;
    }
    factors++;

    // Value similarity (within 20%)
    if (summary.value && opportunity.estimated_value) {
      const valueDiff = Math.abs(summary.value - opportunity.estimated_value) / opportunity.estimated_value;
      if (valueDiff < 0.2) {
        score += 0.3;
      }
    }
    factors++;

    // Stage similarity
    if (summary.stage === opportunity.stage) {
      score += 0.2;
    }
    factors++;

    // Timeline similarity (placeholder - would need more sophisticated logic)
    score += 0.1; // Default similarity for timeline
    factors++;

    return score;
  }

  // Demo/fallback methods
  private generateDemoAnalysis(context: SalesContext): SalesAnalysis {
    const hasFinancialEntity = context.entities.some(e => e.type === 'financial');
    const hasOrganization = context.entities.some(e => e.type === 'organization');
    const hasDate = context.entities.some(e => e.type === 'date');

    const opportunityDetected = hasFinancialEntity && hasOrganization;
    
    const analysis: SalesAnalysis = {
      opportunity_detected: opportunityDetected,
      confidence: opportunityDetected ? 0.75 : 0.25,
      key_insights: hasFinancialEntity 
        ? ['Financial commitment mentioned', 'Business discussion in progress']
        : ['General business conversation'],
      missing_information: [
        'Decision timeline',
        'Budget authority',
        'Current solution evaluation'
      ],
      suggested_questions: [
        'What is driving this initiative?',
        'Who else is involved in the decision process?',
        'What timeline are you working with?'
      ],
      risk_factors: ['Limited information available'],
      next_actions: ['Gather more qualifying information', 'Schedule follow-up meeting']
    };
    
    if (opportunityDetected) {
      analysis.opportunity_summary = {
        title: 'Business Opportunity',
        client: hasOrganization ? context.entities.find(e => e.type === 'organization')?.value || 'Unknown Client' : 'Unknown Client',
        value: hasFinancialEntity ? this.extractFinancialValue(context.entities) : 0,
        currency: 'USD',
        timeline: hasDate ? context.entities.find(e => e.type === 'date')?.value || 'TBD' : 'TBD',
        probability: 0.5,
        stage: 'discovery'
      };
    }
    
    return analysis;
  }

  private generateDemoResponse(analysis: SalesAnalysis, context: SalesContext): ConversationalResponse {
    return {
      analysis,
      response_text: this.generateDemoResponseText(analysis),
      follow_up_questions: analysis.suggested_questions.slice(0, 3),
      suggested_actions: analysis.next_actions,
      opportunity_match: { matched: false }
    };
  }

  private generateDemoResponseText(analysis: SalesAnalysis): string {
    if (analysis.opportunity_detected) {
      return `I can see there's a potential opportunity here with some interesting financial aspects mentioned. To better understand how we might help, could you tell me more about what's driving this initiative and what timeline you're working with?`;
    } else {
      return `Thanks for sharing that information. It sounds like there might be some interesting business challenges to explore. What's the biggest priority you're focusing on right now?`;
    }
  }

  private extractFinancialValue(entities: ExtractedEntity[]): number {
    const financialEntity = entities.find(e => e.type === 'financial');
    if (!financialEntity) return 0;

    // Simple extraction of numeric value from financial strings
    const matches = financialEntity.value.match(/[\d,]+/);
    if (matches) {
      return parseInt(matches[0].replace(/,/g, ''), 10);
    }
    return 0;
  }
} 