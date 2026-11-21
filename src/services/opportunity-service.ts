import type { 
  Opportunity, 
  SalesAnalysis, 
  OpportunityMatch,
  OpportunitySummary,
  ExtractedEntity
} from '../types/index.js';
import { 
  getOpportunitiesByClient,
  getActiveOpportunities,
  insertOpportunity,
  updateOpportunity,
  insertOpportunityUpdate,
  getOpportunityById
} from '../database/duckdb.js';

interface OpportunitySearchCriteria {
  clientName?: string;
  contactPerson?: string;
  valueRange?: { min: number; max: number };
  timelineWindow?: { start: string; end: string };
  stage?: string;
}

interface MergeRecommendation {
  shouldMerge: boolean;
  confidence: number;
  mergeStrategy: 'update_existing' | 'create_new' | 'merge_data';
  conflictingFields: string[];
  recommendations: string[];
}

export class OpportunityService {
  
  // Find matching opportunities based on analysis
  async findOpportunityMatches(
    analysis: SalesAnalysis,
    entities: ExtractedEntity[],
    conversationId: string
  ): Promise<OpportunityMatch[]> {
    console.log('🔍 Searching for opportunity matches...');

    if (!analysis.opportunity_detected || !analysis.opportunity_summary) {
      return [{ matched: false }];
    }

    try {
      const searchCriteria = this.buildSearchCriteria(analysis.opportunity_summary, entities);
      const candidateOpportunities = await this.searchOpportunities(searchCriteria);
      
      if (candidateOpportunities.length === 0) {
        console.log('📭 No matching opportunities found');
        return [{ matched: false }];
      }

      const matches: OpportunityMatch[] = [];
      
      for (const opportunity of candidateOpportunities) {
        const similarity = this.calculateSimilarityScore(analysis.opportunity_summary, opportunity);
        const differences = this.identifyDifferences(analysis.opportunity_summary, opportunity);
        
        matches.push({
          matched: true,
          existing_opportunity: opportunity,
          similarity_score: similarity,
          merge_recommended: similarity > 0.7,
          differences: differences
        });
      }

      // Sort by similarity score (highest first)
      matches.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));
      
      console.log(`✅ Found ${matches.length} potential matches`);
      return matches;

    } catch (error) {
      console.error('❌ Error finding opportunity matches:', error);
      return [{ matched: false }];
    }
  }

  // Create new opportunity from analysis
  async createOpportunityFromAnalysis(
    analysis: SalesAnalysis,
    conversationId: string,
    entities: ExtractedEntity[]
  ): Promise<string | null> {
    if (!analysis.opportunity_detected || !analysis.opportunity_summary) {
      console.log('⚠️ No opportunity detected, skipping creation');
      return null;
    }

    const summary = analysis.opportunity_summary;
    
    try {
      console.log('💼 Creating new opportunity from analysis...');
      
      const opportunityData: any = {
        title: this.generateOpportunityTitle(summary, entities),
        description: this.generateOpportunityDescription(analysis, entities),
        client_organization: summary.client,
        contact_person: this.extractContactPerson(entities),
        estimated_value: summary.value || null,
        currency: summary.currency || 'USD',
        probability: summary.probability || 0.5,
        stage: summary.stage || 'discovery',
        source_conversation_id: conversationId,
        context_summary: analysis.key_insights.join('; '),
        metadata: {
          analysis_confidence: analysis.confidence,
          risk_factors: analysis.risk_factors,
          created_by: 'opportunity_service',
          entity_count: entities.length,
          created_at: new Date().toISOString()
        }
      };

      // Parse and add decision date if available
      const decisionDate = this.parseDecisionDate(summary.timeline);
      if (decisionDate) {
        opportunityData.decision_date = decisionDate;
      }

      const opportunityId = await insertOpportunity(opportunityData);
      
      // Log the creation as an opportunity update
      await insertOpportunityUpdate({
        opportunity_id: opportunityId,
        conversation_id: conversationId,
        update_type: 'creation',
        summary: `Opportunity created from conversation analysis with ${analysis.confidence * 100}% confidence`,
        confidence: analysis.confidence,
        metadata: {
          initial_entities: entities.length,
          analysis_insights: analysis.key_insights.length
        }
      });

      console.log(`✅ Created opportunity: ${opportunityId}`);
      return opportunityId;

    } catch (error) {
      console.error('❌ Failed to create opportunity:', error);
      return null;
    }
  }

  // Merge opportunities or update existing one
  async mergeOrUpdateOpportunity(
    existingOpportunityId: string,
    analysis: SalesAnalysis,
    conversationId: string,
    entities: ExtractedEntity[]
  ): Promise<boolean> {
    try {
      console.log(`🔄 Merging/updating opportunity: ${existingOpportunityId}`);
      
      const existingOpportunity = await getOpportunityById(existingOpportunityId);
      if (!existingOpportunity || !analysis.opportunity_summary) {
        return false;
      }

      const mergeRecommendation = this.analyzeMergeRecommendation(
        existingOpportunity, 
        analysis.opportunity_summary
      );

      if (!mergeRecommendation.shouldMerge) {
        console.log('⚠️ Merge not recommended, creating update entry only');
        await this.logOpportunityUpdate(existingOpportunityId, conversationId, analysis, 'info_update');
        return true;
      }

      // Perform the merge based on strategy
      const updatedFields = await this.performMerge(
        existingOpportunity,
        analysis.opportunity_summary,
        mergeRecommendation,
        entities
      );

      if (Object.keys(updatedFields).length > 0) {
        const success = await updateOpportunity(existingOpportunityId, updatedFields);
        
        if (success) {
          await this.logOpportunityUpdate(
            existingOpportunityId, 
            conversationId, 
            analysis, 
            'merge_update',
            Object.keys(updatedFields)
          );
          
          console.log(`✅ Successfully merged opportunity with fields: ${Object.keys(updatedFields).join(', ')}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error merging opportunity:', error);
      return false;
    }
  }

  // Build search criteria from opportunity summary and entities
  private buildSearchCriteria(
    summary: OpportunitySummary, 
    entities: ExtractedEntity[]
  ): OpportunitySearchCriteria {
    const criteria: OpportunitySearchCriteria = {};
    
    if (summary.client) {
      criteria.clientName = summary.client;
    }
    
    // Extract contact person from entities
    const personEntities = entities.filter(e => e.type === 'person');
    if (personEntities.length > 0) {
      criteria.contactPerson = personEntities[0].value;
    }
    
    // Value range (±20% of estimated value)
    if (summary.value && summary.value > 0) {
      const variance = summary.value * 0.2;
      criteria.valueRange = {
        min: summary.value - variance,
        max: summary.value + variance
      };
    }
    
    return criteria;
  }

  // Search for opportunities based on criteria
  private async searchOpportunities(criteria: OpportunitySearchCriteria): Promise<Opportunity[]> {
    let opportunities: Opportunity[] = [];
    
    // Primary search by client name
    if (criteria.clientName) {
      opportunities = await getOpportunitiesByClient(criteria.clientName);
    } else {
      // Fallback to active opportunities
      opportunities = await getActiveOpportunities(50);
    }
    
    // Apply additional filters
    return opportunities.filter(opp => {
      // Contact person filter
      if (criteria.contactPerson && opp.contact_person) {
        const contactMatch = opp.contact_person.toLowerCase().includes(
          criteria.contactPerson.toLowerCase()
        );
        if (!contactMatch) return false;
      }
      
      // Value range filter
      if (criteria.valueRange && opp.estimated_value) {
        if (opp.estimated_value < criteria.valueRange.min || 
            opp.estimated_value > criteria.valueRange.max) {
          return false;
        }
      }
      
      return true;
    });
  }

  // Calculate similarity score between summary and existing opportunity
  private calculateSimilarityScore(summary: OpportunitySummary, opportunity: Opportunity): number {
    let score = 0;
    let factors = 0;

    // Client name similarity (weighted heavily)
    if (summary.client && opportunity.client_organization) {
      const clientSimilarity = this.calculateStringSimilarity(
        summary.client.toLowerCase(),
        opportunity.client_organization.toLowerCase()
      );
      score += clientSimilarity * 0.4;
    }
    factors++;

    // Value similarity (within reasonable range)
    if (summary.value && opportunity.estimated_value) {
      const valueDiff = Math.abs(summary.value - opportunity.estimated_value);
      const avgValue = (summary.value + opportunity.estimated_value) / 2;
      const valueScore = Math.max(0, 1 - (valueDiff / avgValue));
      score += valueScore * 0.3;
    }
    factors++;

    // Stage similarity
    if (summary.stage && opportunity.stage && summary.stage === opportunity.stage) {
      score += 0.2;
    }
    factors++;

    // Currency match
    if (summary.currency && opportunity.currency && summary.currency === opportunity.currency) {
      score += 0.1;
    }
    factors++;

    return score;
  }

  // Calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  // Levenshtein distance algorithm
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(0).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Identify differences between summary and existing opportunity
  private identifyDifferences(summary: OpportunitySummary, opportunity: Opportunity): string[] {
    const differences: string[] = [];
    
    if (summary.value !== opportunity.estimated_value) {
      differences.push(`Value: ${summary.value} vs ${opportunity.estimated_value}`);
    }
    
    if (summary.stage !== opportunity.stage) {
      differences.push(`Stage: ${summary.stage} vs ${opportunity.stage}`);
    }
    
    if (summary.currency !== opportunity.currency) {
      differences.push(`Currency: ${summary.currency} vs ${opportunity.currency}`);
    }
    
    if (summary.probability && opportunity.probability && 
        Math.abs(summary.probability - opportunity.probability) > 0.1) {
      differences.push(`Probability: ${summary.probability} vs ${opportunity.probability}`);
    }
    
    return differences;
  }

  // Analyze merge recommendation
  private analyzeMergeRecommendation(
    existing: Opportunity, 
    summary: OpportunitySummary
  ): MergeRecommendation {
    const conflictingFields: string[] = [];
    
    // Check for conflicts
    if (existing.estimated_value && summary.value && 
        Math.abs(existing.estimated_value - summary.value) > existing.estimated_value * 0.3) {
      conflictingFields.push('estimated_value');
    }
    
    if (existing.stage !== summary.stage) {
      conflictingFields.push('stage');
    }
    
    const shouldMerge = conflictingFields.length <= 2; // Allow merge if few conflicts
    const confidence = shouldMerge ? (1 - conflictingFields.length * 0.2) : 0.3;
    
    return {
      shouldMerge,
      confidence,
      mergeStrategy: conflictingFields.length === 0 ? 'update_existing' : 'merge_data',
      conflictingFields,
      recommendations: this.generateMergeRecommendations(conflictingFields)
    };
  }

  // Perform the actual merge operation
  private async performMerge(
    existing: Opportunity,
    summary: OpportunitySummary,
    recommendation: MergeRecommendation,
    entities: ExtractedEntity[]
  ): Promise<Record<string, any>> {
    const updates: Record<string, any> = {};
    
    // Update fields based on merge strategy
    if (recommendation.mergeStrategy === 'update_existing') {
      // Take newer/more confident values
      if (!existing.estimated_value && summary.value) {
        updates.estimated_value = summary.value;
      }
      
      if (!existing.contact_person) {
        const contactPerson = this.extractContactPerson(entities);
        if (contactPerson) {
          updates.contact_person = contactPerson;
        }
      }
      
      // Update probability if new value is more optimistic and reasonable
      if (summary.probability && existing.probability && 
          summary.probability > existing.probability && summary.probability <= 1.0) {
        updates.probability = summary.probability;
      }
    }
    
    // Always update the context summary to include new insights
    const currentContext = existing.context_summary || '';
    const newInsights = summary.timeline; // Add timeline info
    if (newInsights && !currentContext.includes(newInsights)) {
      updates.context_summary = currentContext ? `${currentContext}; ${newInsights}` : newInsights;
    }
    
    return updates;
  }

  // Log opportunity update
  private async logOpportunityUpdate(
    opportunityId: string,
    conversationId: string,
    analysis: SalesAnalysis,
    updateType: string,
    updatedFields?: string[]
  ): Promise<void> {
    const summary = updatedFields 
      ? `Updated fields: ${updatedFields.join(', ')}`
      : `Conversation analysis (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`;
    
    await insertOpportunityUpdate({
      opportunity_id: opportunityId,
      conversation_id: conversationId,
      update_type: updateType,
      summary,
      confidence: analysis.confidence,
      metadata: {
        insights: analysis.key_insights,
        missing_info: analysis.missing_information,
        updated_fields: updatedFields || []
      }
    });
  }

  // Helper methods
  private generateOpportunityTitle(summary: OpportunitySummary, entities: ExtractedEntity[]): string {
    const client = summary.client || 'Unknown Client';
    const value = summary.value ? ` - ${summary.currency}${summary.value.toLocaleString()}` : '';
    return `${client} Opportunity${value}`;
  }

  private generateOpportunityDescription(analysis: SalesAnalysis, entities: ExtractedEntity[]): string {
    const insights = analysis.key_insights.slice(0, 3).join('. ');
    const entityTypes = [...new Set(entities.map(e => e.type))].join(', ');
    
    return `Opportunity identified through conversation analysis. Key insights: ${insights}. Entities discussed: ${entityTypes}.`;
  }

  private extractContactPerson(entities: ExtractedEntity[]): string | undefined {
    const personEntity = entities.find(e => e.type === 'person');
    return personEntity?.value;
  }

  private parseDecisionDate(timeline: string): string | undefined {
    // Enhanced date parsing
    const patterns = [
      /(\d{4}-\d{2}-\d{2})/,  // YYYY-MM-DD
      /(\d{1,2}\/\d{1,2}\/\d{4})/, // MM/DD/YYYY
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
    ];

    for (const pattern of patterns) {
      const match = timeline.match(pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
          }
        } catch (error) {
          continue;
        }
      }
    }

    return undefined;
  }

  private generateMergeRecommendations(conflictingFields: string[]): string[] {
    const recommendations: string[] = [];
    
    if (conflictingFields.includes('estimated_value')) {
      recommendations.push('Review value estimates from both sources');
    }
    
    if (conflictingFields.includes('stage')) {
      recommendations.push('Verify current opportunity stage with client');
    }
    
    if (conflictingFields.length === 0) {
      recommendations.push('Safe to merge - no conflicts detected');
    }
    
    return recommendations;
  }
} 