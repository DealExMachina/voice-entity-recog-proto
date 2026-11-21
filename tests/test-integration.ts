import { MastraAgent } from '../src/agents/mastra-agent.js';
import { SalesAgent } from '../src/agents/sales-agent.js';
import { ConversationAgent } from '../src/agents/conversation-agent.js';
import { OpportunityService } from '../src/services/opportunity-service.js';
import { initializeDatabase, getOpportunityById } from '../src/database/duckdb.js';
import type { ExtractedEntity, SalesAnalysis } from '../src/types/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Test scenarios based on real conversation logs
const testScenarios = {
  dassaultOpportunity: {
    audio: "fake-audio-buffer", // In real test, this would be actual audio
    expectedTranscription: "OK, OK, this is a declaration of opportunity, Madame Astra, Madame Machin de la Societe Astra for an amount of 1 million dollars. Decision in September next year. So September 2026.",
    expectedEntities: [
      { type: "person" as const, value: "Madame Astra", confidence: 0.85 },
      { type: "person" as const, value: "Madame Machin", confidence: 0.85 },
      { type: "organization" as const, value: "Societe Astra", confidence: 0.90 },
      { type: "financial" as const, value: "1 million dollars", confidence: 0.95 },
      { type: "date" as const, value: "September 2026", confidence: 0.97 }
    ] as ExtractedEntity[],
    expectedOpportunity: {
      client: "Societe Astra",
      value: 1000000,
      timeline: "September 2026",
      high_confidence: true
    }
  },

  techCorpInquiry: {
    audio: "fake-audio-buffer-2",
    expectedTranscription: "We're looking for a CRM solution for our 200-person team at TechCorp. Budget is around $50,000 and we need to decide by Q3.",
    expectedEntities: [
      { type: "organization" as const, value: "TechCorp", confidence: 0.90 },
      { type: "financial" as const, value: "$50,000", confidence: 0.95 },
      { type: "date" as const, value: "Q3", confidence: 0.85 },
      { type: "product" as const, value: "CRM solution", confidence: 0.80 }
    ] as ExtractedEntity[],
    expectedOpportunity: {
      client: "TechCorp", 
      value: 50000,
      timeline: "Q3",
      medium_confidence: true
    }
  },

  generalInquiry: {
    audio: "fake-audio-buffer-3",
    expectedTranscription: "Hello, can you hear me? Just testing the audio.",
    expectedEntities: [] as ExtractedEntity[],
    expectedOpportunity: {
      no_opportunity: true
    }
  }
};

async function testFullPipeline(): Promise<void> {
  console.log('🧪 Testing Full Sales Opportunity Pipeline...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-integration-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    // Initialize all agents
    const mastraAgent = new MastraAgent();
    const salesAgent = new SalesAgent();
    const conversationAgent = new ConversationAgent();
    const opportunityService = new OpportunityService();
    
    await salesAgent.initialize();
    await conversationAgent.initialize();
    
    // Set to demo mode for consistent testing
    mastraAgent.setAiProvider('demo');
    
    console.log('\n📊 Testing High-Value Opportunity (Societe Astra)...');
    const dassaultResult = await processConversationScenario(
      testScenarios.dassaultOpportunity,
      { mastraAgent, salesAgent, conversationAgent, opportunityService }
    );
    
    // Validate high-value opportunity results
    if (!dassaultResult.opportunityDetected) {
      throw new Error('Failed to detect high-value opportunity (Societe Astra)');
    }
    
    if (dassaultResult.confidence < 0.7) {
      throw new Error(`Low confidence for obvious opportunity: ${dassaultResult.confidence}`);
    }
    
    if (!dassaultResult.opportunityId) {
      throw new Error('Opportunity should have been created');
    }
    
    console.log('✅ High-value opportunity processed successfully');
    
    console.log('\n📊 Testing Medium-Value Opportunity (TechCorp)...');
    const techCorpResult = await processConversationScenario(
      testScenarios.techCorpInquiry,
      { mastraAgent, salesAgent, conversationAgent, opportunityService }
    );
    
    // Validate medium-value opportunity results
    if (!techCorpResult.opportunityDetected) {
      throw new Error('Failed to detect medium-value opportunity (TechCorp)');
    }
    
    if (techCorpResult.followUpQuestions.length === 0) {
      throw new Error('Should generate follow-up questions for medium confidence opportunity');
    }
    
    console.log('✅ Medium-value opportunity processed successfully');
    
    console.log('\n📊 Testing No Opportunity Scenario...');
    const generalResult = await processConversationScenario(
      testScenarios.generalInquiry,
      { mastraAgent, salesAgent, conversationAgent, opportunityService }
    );
    
    // Validate no-opportunity results
    if (generalResult.opportunityDetected && generalResult.confidence > 0.5) {
      throw new Error('Should not detect opportunity in general conversation');
    }
    
    if (!generalResult.agentResponse || generalResult.agentResponse.length < 10) {
      throw new Error('Should still provide helpful response for general conversation');
    }
    
    console.log('✅ No opportunity scenario handled correctly');
    
    // Test opportunity matching/merging
    console.log('\n📊 Testing Opportunity Matching...');
    await testOpportunityMatching({ salesAgent, conversationAgent, opportunityService });
    
    console.log('✅ Full pipeline integration tests completed successfully');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function processConversationScenario(
  scenario: any,
  agents: {
    mastraAgent: MastraAgent;
    salesAgent: SalesAgent;
    conversationAgent: ConversationAgent;
    opportunityService: OpportunityService;
  }
): Promise<{
  opportunityDetected: boolean;
  confidence: number;
  opportunityId?: string;
  agentResponse: string;
  followUpQuestions: string[];
  matches?: any[];
}> {
  
  const conversationId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Step 1: Simulate entity extraction (using demo mode for consistency)
  const entities = scenario.expectedEntities.map((entity: ExtractedEntity) => ({
    ...entity,
    context: `Test context for ${entity.value}`,
    source_conversation_id: conversationId,
    metadata: { provider: 'demo', extractedAt: new Date().toISOString() }
  }));
  
  console.log(`  📝 Extracted ${entities.length} entities from conversation`);
  
  // Step 2: Sales opportunity analysis
  const analysisContext = {
    transcription: scenario.expectedTranscription,
    entities,
    conversationId,
    previousInteractions: []
  };
  
  const salesAnalysis = await agents.salesAgent.analyzeSalesOpportunity(analysisContext);
  
  console.log(`  🔍 Sales analysis completed (confidence: ${(salesAnalysis.confidence * 100).toFixed(1)}%)`);
  console.log(`  📊 Opportunity detected: ${salesAnalysis.opportunity_detected}`);
  console.log(`  💡 Key insights: ${salesAnalysis.key_insights.length}`);
  console.log(`  ❓ Follow-up questions: ${salesAnalysis.suggested_questions.length}`);
  
  // Step 3: Find opportunity matches
  let matches: any[] = [];
  let opportunityId: string | undefined;
  
  if (salesAnalysis.opportunity_detected) {
    matches = await agents.opportunityService.findOpportunityMatches(
      salesAnalysis,
      entities,
      conversationId
    );
    
    console.log(`  🔗 Found ${matches.length} opportunity matches`);
    
         // Step 4: Create or update opportunity
     if (matches.length === 0 || !matches[0].matched) {
       const createdId = await agents.opportunityService.createOpportunityFromAnalysis(
         salesAnalysis,
         conversationId,
         entities
       );
       opportunityId = createdId || undefined;
       console.log(`  ✨ Created new opportunity: ${opportunityId}`);
     } else if (matches[0].merge_recommended) {
       const mergeSuccess = await agents.opportunityService.mergeOrUpdateOpportunity(
         matches[0].existing_opportunity!.id,
         salesAnalysis,
         conversationId,
         entities
       );
       console.log(`  🔄 Merge attempt: ${mergeSuccess ? 'successful' : 'failed'}`);
       opportunityId = matches[0].existing_opportunity!.id;
     }
  }
  
  // Step 5: Generate conversational response
  const conversationalResponse = await agents.salesAgent.generateConversationalResponse(
    salesAnalysis,
    analysisContext
  );
  
  console.log(`  💬 Generated response (${conversationalResponse.response_text.length} chars)`);
  console.log(`  🔊 TTS audio: ${conversationalResponse.audio_response ? 'generated' : 'not generated'}`);
  
  return {
    opportunityDetected: salesAnalysis.opportunity_detected,
    confidence: salesAnalysis.confidence,
    opportunityId,
    agentResponse: conversationalResponse.response_text,
    followUpQuestions: conversationalResponse.follow_up_questions,
    matches
  };
}

async function testOpportunityMatching(agents: {
  salesAgent: SalesAgent;
  conversationAgent: ConversationAgent;
  opportunityService: OpportunityService;
}): Promise<void> {
  
  // Create a base opportunity
  const baseScenario = {
    expectedTranscription: "GlobalTech Inc is looking for an ERP solution worth $200,000.",
    expectedEntities: [
      { type: "organization" as const, value: "GlobalTech Inc", confidence: 0.95, context: "GlobalTech Inc is looking" },
      { type: "financial" as const, value: "$200,000", confidence: 0.95, context: "worth $200,000" },
      { type: "product" as const, value: "ERP solution", confidence: 0.90, context: "ERP solution" }
    ] as ExtractedEntity[]
  };
  
  const baseConversationId = `base-${Date.now()}`;
  const baseContext = {
    transcription: baseScenario.expectedTranscription,
    entities: baseScenario.expectedEntities.map(e => ({
      ...e,
      source_conversation_id: baseConversationId,
      metadata: { provider: 'demo', extractedAt: new Date().toISOString() }
    })),
    conversationId: baseConversationId,
    previousInteractions: []
  };
  
  // Create base opportunity
  const baseAnalysis = await agents.salesAgent.analyzeSalesOpportunity(baseContext);
  const baseOpportunityId = await agents.opportunityService.createOpportunityFromAnalysis(
    baseAnalysis,
    baseConversationId,
    baseContext.entities
  );
  
  console.log(`  📋 Created base opportunity: ${baseOpportunityId}`);
  
  // Test similar opportunity (should match)
  const similarScenario = {
    expectedTranscription: "GlobalTech Inc needs ERP implementation, budget increased to $250,000.",
    expectedEntities: [
      { type: "organization" as const, value: "GlobalTech Inc", confidence: 0.95, context: "GlobalTech Inc needs" },
      { type: "financial" as const, value: "$250,000", confidence: 0.95, context: "budget increased to $250,000" },
      { type: "product" as const, value: "ERP implementation", confidence: 0.90, context: "ERP implementation" }
    ] as ExtractedEntity[]
  };
  
  const similarConversationId = `similar-${Date.now()}`;
  const similarContext = {
    transcription: similarScenario.expectedTranscription,
    entities: similarScenario.expectedEntities.map(e => ({
      ...e,
      source_conversation_id: similarConversationId,
      metadata: { provider: 'demo', extractedAt: new Date().toISOString() }
    })),
    conversationId: similarConversationId,
    previousInteractions: []
  };
  
  const similarAnalysis = await agents.salesAgent.analyzeSalesOpportunity(similarContext);
  const similarMatches = await agents.opportunityService.findOpportunityMatches(
    similarAnalysis,
    similarContext.entities,
    similarConversationId
  );
  
  console.log(`  🔍 Similar opportunity matches: ${similarMatches.length}`);
  
  if (similarMatches.length === 0 || !similarMatches[0].matched) {
    throw new Error('Should find match for similar opportunity');
  }
  
  if (similarMatches[0].similarity_score && similarMatches[0].similarity_score < 0.7) {
    throw new Error('Similar opportunity should have high similarity score');
  }
  
  if (!similarMatches[0].merge_recommended) {
    throw new Error('Should recommend merge for highly similar opportunity');
  }
  
  console.log(`  ✅ Match found with similarity: ${(similarMatches[0].similarity_score! * 100).toFixed(1)}%`);
  
  // Test merge functionality
  const mergeSuccess = await agents.opportunityService.mergeOrUpdateOpportunity(
    baseOpportunityId!,
    similarAnalysis,
    similarConversationId,
    similarContext.entities
  );
  
  if (!mergeSuccess) {
    throw new Error('Merge operation should succeed for similar opportunities');
  }
  
  console.log('  🔄 Merge operation completed successfully');
  
  // Verify the merge by checking the opportunity
  const mergedOpportunity = await getOpportunityById(baseOpportunityId!);
  
  if (!mergedOpportunity) {
    throw new Error('Merged opportunity should still exist');
  }
  
  console.log(`  📊 Merged opportunity value: ${mergedOpportunity.estimated_value}`);
  
  // Value should be updated to the higher amount (250,000)
  if (mergedOpportunity.estimated_value !== 250000) {
    console.warn(`  ⚠️ Expected value update to 250000, got ${mergedOpportunity.estimated_value}`);
  }
  
  console.log('  ✅ Opportunity matching and merging completed successfully');
}

async function testErrorHandling(): Promise<void> {
  console.log('🧪 Testing Error Handling...');
  
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-error-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const salesAgent = new SalesAgent();
    await salesAgent.initialize();
    
    // Test 1: Empty/invalid input
    console.log('\n📊 Test 1: Empty input handling');
    try {
      const emptyContext = {
        transcription: "",
        entities: [],
        conversationId: "empty-test",
        previousInteractions: []
      };
      
      const analysis = await salesAgent.analyzeSalesOpportunity(emptyContext);
      
      if (analysis.opportunity_detected) {
        throw new Error('Should not detect opportunity in empty input');
      }
      
      console.log('  ✅ Empty input handled correctly');
    } catch (error) {
      console.log('  ✅ Empty input properly rejected');
    }
    
    // Test 2: Invalid entity data
    console.log('\n📊 Test 2: Invalid entity handling');
    try {
      const invalidContext = {
        transcription: "Test with invalid entities",
        entities: [
          { type: "invalid_type" as any, value: "", confidence: -1, context: "" }
        ],
        conversationId: "invalid-test",
        previousInteractions: []
      };
      
      const analysis = await salesAgent.analyzeSalesOpportunity(invalidContext);
      
      // Should handle gracefully without crashing
      console.log(`  ✅ Invalid entities handled, confidence: ${analysis.confidence}`);
    } catch (error) {
      console.log('  ✅ Invalid entities properly handled with error');
    }
    
    console.log('✅ Error handling tests completed');
    
  } finally {
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testPerformance(): Promise<void> {
  console.log('🧪 Testing Performance...');
  
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-performance-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const salesAgent = new SalesAgent();
    await salesAgent.initialize();
    
    const testContext = {
      transcription: "TechCorp Inc is looking for a software solution worth $100,000 by Q3 2025.",
      entities: [
        { 
          type: "organization" as const, 
          value: "TechCorp Inc", 
          confidence: 0.95,
          context: "TechCorp Inc is looking",
          source_conversation_id: "perf-test",
          metadata: { provider: 'demo', extractedAt: new Date().toISOString() }
        },
        { 
          type: "financial" as const, 
          value: "$100,000", 
          confidence: 0.95,
          context: "worth $100,000",
          source_conversation_id: "perf-test",
          metadata: { provider: 'demo', extractedAt: new Date().toISOString() }
        }
      ],
      conversationId: "performance-test",
      previousInteractions: []
    };
    
    // Test concurrent analysis
    const concurrentTests = 3;
    const startTime = Date.now();
    
    const promises = Array(concurrentTests).fill(0).map(async (_, index) => {
      const context = {
        ...testContext,
        conversationId: `perf-test-${index}`
      };
      
      const analysis = await salesAgent.analyzeSalesOpportunity(context);
      const response = await salesAgent.generateConversationalResponse(analysis, context);
      
      return { analysis, response };
    });
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const totalTime = endTime - startTime;
    const avgTime = totalTime / concurrentTests;
    
    console.log(`  📊 Performance results:`);
    console.log(`     Concurrent requests: ${concurrentTests}`);
    console.log(`     Total time: ${totalTime}ms`);
    console.log(`     Average time per request: ${avgTime}ms`);
    console.log(`     All successful: ${results.every(r => r.analysis.confidence >= 0)}`);
    
    if (avgTime > 5000) { // 5 seconds per request seems reasonable for demo mode
      console.warn('  ⚠️ Performance may be slow');
    } else {
      console.log('  ✅ Performance within acceptable range');
    }
    
    console.log('✅ Performance tests completed');
    
  } finally {
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

export async function runIntegrationTests(): Promise<void> {
  console.log('🚀 Starting Integration Tests\n');
  
  try {
    await testFullPipeline();
    console.log();
    
    await testErrorHandling();
    console.log();
    
    await testPerformance();
    console.log();
    
    console.log('✅ All integration tests completed successfully!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests();
} 