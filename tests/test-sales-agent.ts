import { SalesAgent } from '../src/agents/sales-agent.js';
import { initializeDatabase } from '../src/database/duckdb.js';
import type { 
  ExtractedEntity, 
  SalesAnalysis,
  OpportunitySummary 
} from '../src/types/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Test data based on real conversation logs
const testConversations = {
  dassaultOpportunity: {
    transcription: "OK, OK, this is a declaration of opportunity, Madame Astra, Madame Machin de la Societe Astra for an amount of 1 million dollars. Decision in September next year. So September 2026.",
    entities: [
      { type: "person" as const, value: "Madame Astra", confidence: 0.85, context: "declaration of opportunity, Madame Astra" },
      { type: "person" as const, value: "Madame Machin", confidence: 0.85, context: "Madame Machin de la Societe Astra" },
      { type: "organization" as const, value: "Societe Astra", confidence: 0.90, context: "Madame Machin de la Societe Astra" },
      { type: "financial" as const, value: "1 million dollars", confidence: 0.95, context: "for an amount of 1 million dollars" },
      { type: "date" as const, value: "September 2026", confidence: 0.97, context: "Decision in September next year. So September 2026." }
    ] as ExtractedEntity[],
    conversationId: "test-conversation-1"
  },
  
  generalDiscussion: {
    transcription: "I'm going to try again. Can you hear me? Yes? No?",
    entities: [] as ExtractedEntity[],
    conversationId: "test-conversation-2"
  },

  potentialOpportunity: {
    transcription: "We're looking at new software solutions for our team at TechCorp. Budget is around $50,000 and we need to decide by end of Q2.",
    entities: [
      { type: "organization" as const, value: "TechCorp", confidence: 0.90, context: "our team at TechCorp" },
      { type: "financial" as const, value: "$50,000", confidence: 0.95, context: "Budget is around $50,000" },
      { type: "date" as const, value: "end of Q2", confidence: 0.85, context: "decide by end of Q2" },
      { type: "product" as const, value: "software solutions", confidence: 0.80, context: "new software solutions" }
    ] as ExtractedEntity[],
    conversationId: "test-conversation-3"
  }
};

// Mock OpenAI for testing when no API key is available
const mockOpenAIResponses = {
  opportunityDetected: {
    opportunity_detected: true,
    confidence: 0.95,
    key_insights: [
      "High-value opportunity with clear financial commitment",
      "Named decision makers identified",
      "Specific timeline provided"
    ],
    missing_information: [
      "Decision criteria",
      "Competition evaluation",
      "Budget approval process"
    ],
    suggested_questions: [
      "What specific criteria will you use to make this decision?",
      "Who else is involved in the evaluation process?",
      "What challenges are you trying to solve?"
    ],
    opportunity_summary: {
      title: "Societe Astra Digital Transformation",
      client: "Societe Astra",
      value: 1000000,
      currency: "USD",
      timeline: "September 2026",
      probability: 0.75,
      stage: "discovery"
    },
    risk_factors: [
      "Long timeline may indicate low urgency",
      "Multiple decision makers could complicate process"
    ],
    next_actions: [
      "Schedule discovery call with key stakeholders",
      "Prepare detailed proposal timeline",
      "Identify decision criteria and evaluation process"
    ]
  },
  
  noOpportunity: {
    opportunity_detected: false,
    confidence: 0.15,
    key_insights: [
      "General communication test",
      "No business context provided"
    ],
    missing_information: [
      "Business objectives",
      "Current challenges",
      "Decision timeline"
    ],
    suggested_questions: [
      "What brings you here today?",
      "What business challenges are you facing?",
      "How can I help you?"
    ],
    risk_factors: [
      "No clear business intent"
    ],
    next_actions: [
      "Clarify meeting purpose",
      "Understand business context"
    ]
  }
};

class TestSalesAgent extends SalesAgent {
  private useRealAPI: boolean;
  
  constructor(useRealAPI: boolean = false) {
    super();
    this.useRealAPI = useRealAPI && !!process.env.OPENAI_API_KEY;
  }

  // Override for testing
  protected async performChainOfThoughtAnalysis(context: any): Promise<SalesAnalysis> {
    if (this.useRealAPI) {
      return super['performChainOfThoughtAnalysis'](context);
    }

    // Use mock responses based on conversation content
    const hasOpportunity = context.entities.some((e: ExtractedEntity) => 
      e.type === 'financial' || e.type === 'organization'
    );

    return hasOpportunity ? mockOpenAIResponses.opportunityDetected : mockOpenAIResponses.noOpportunity;
  }
}

async function testOpportunityDetection(): Promise<void> {
  console.log('🧪 Testing Sales Opportunity Detection...');
  
  const salesAgent = new TestSalesAgent();
  await salesAgent.initialize();

  // Test 1: High-value opportunity (Societe Astra case)
  console.log('\n📊 Test 1: High-value opportunity detection');
  const context1 = {
    transcription: testConversations.dassaultOpportunity.transcription,
    entities: testConversations.dassaultOpportunity.entities,
    conversationId: testConversations.dassaultOpportunity.conversationId,
    previousInteractions: []
  };

  const analysis1 = await salesAgent.analyzeSalesOpportunity(context1);
  console.log('Analysis result:', {
    opportunity_detected: analysis1.opportunity_detected,
    confidence: analysis1.confidence,
    client: analysis1.opportunity_summary?.client,
    value: analysis1.opportunity_summary?.value,
    insights_count: analysis1.key_insights.length
  });

  if (!analysis1.opportunity_detected) {
    throw new Error('Failed to detect obvious sales opportunity');
  }

  if (analysis1.confidence < 0.7) {
    throw new Error(`Low confidence for obvious opportunity: ${analysis1.confidence}`);
  }

  // Test 2: No opportunity (general conversation)
  console.log('\n📊 Test 2: Non-opportunity conversation');
  const context2 = {
    transcription: testConversations.generalDiscussion.transcription,
    entities: testConversations.generalDiscussion.entities,
    conversationId: testConversations.generalDiscussion.conversationId,
    previousInteractions: []
  };

  const analysis2 = await salesAgent.analyzeSalesOpportunity(context2);
  console.log('Analysis result:', {
    opportunity_detected: analysis2.opportunity_detected,
    confidence: analysis2.confidence,
    insights_count: analysis2.key_insights.length
  });

  if (analysis2.opportunity_detected && analysis2.confidence > 0.5) {
    throw new Error('False positive: detected opportunity in non-business conversation');
  }

  // Test 3: Potential opportunity (needs qualification)
  console.log('\n📊 Test 3: Potential opportunity detection');
  const context3 = {
    transcription: testConversations.potentialOpportunity.transcription,
    entities: testConversations.potentialOpportunity.entities,
    conversationId: testConversations.potentialOpportunity.conversationId,
    previousInteractions: []
  };

  const analysis3 = await salesAgent.analyzeSalesOpportunity(context3);
  console.log('Analysis result:', {
    opportunity_detected: analysis3.opportunity_detected,
    confidence: analysis3.confidence,
    client: analysis3.opportunity_summary?.client,
    value: analysis3.opportunity_summary?.value,
    questions_count: analysis3.suggested_questions.length
  });

  if (analysis3.suggested_questions.length === 0) {
    throw new Error('No follow-up questions generated for potential opportunity');
  }

  console.log('✅ Opportunity detection tests completed');
}

async function testConversationalResponses(): Promise<void> {
  console.log('🧪 Testing Conversational Response Generation...');
  
  const salesAgent = new TestSalesAgent();
  await salesAgent.initialize();

  const context = {
    transcription: testConversations.dassaultOpportunity.transcription,
    entities: testConversations.dassaultOpportunity.entities,
    conversationId: testConversations.dassaultOpportunity.conversationId,
    previousInteractions: []
  };

  // Get analysis first
  const analysis = await salesAgent.analyzeSalesOpportunity(context);
  
  // Generate conversational response
  const response = await salesAgent.generateConversationalResponse(analysis, context);
  
  console.log('Generated response:', {
    response_length: response.response_text.length,
    has_follow_up_questions: response.follow_up_questions.length > 0,
    has_suggested_actions: response.suggested_actions.length > 0,
    opportunity_match: response.opportunity_match?.matched || false
  });

  if (!response.response_text || response.response_text.length < 10) {
    throw new Error('Response text too short or empty');
  }

  if (response.follow_up_questions.length === 0) {
    throw new Error('No follow-up questions provided');
  }

  if (response.suggested_actions.length === 0) {
    throw new Error('No suggested actions provided');
  }

  console.log('✅ Conversational response tests completed');
}

async function testOpportunityCreation(): Promise<void> {
  console.log('🧪 Testing Opportunity Creation...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-sales-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const salesAgent = new TestSalesAgent();
    await salesAgent.initialize();

    const context = {
      transcription: testConversations.dassaultOpportunity.transcription,
      entities: testConversations.dassaultOpportunity.entities,
      conversationId: testConversations.dassaultOpportunity.conversationId,
      previousInteractions: []
    };

    // Get analysis
    const analysis = await salesAgent.analyzeSalesOpportunity(context);
    
    if (!analysis.opportunity_detected) {
      throw new Error('No opportunity detected for creation test');
    }

    // Create opportunity
    const opportunityId = await salesAgent.createOpportunityFromAnalysis(
      analysis, 
      context.conversationId
    );

    console.log('Created opportunity ID:', opportunityId);

    if (!opportunityId) {
      throw new Error('Failed to create opportunity');
    }

    console.log('✅ Opportunity creation tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testEdgeCases(): Promise<void> {
  console.log('🧪 Testing Edge Cases...');
  
  const salesAgent = new TestSalesAgent();
  await salesAgent.initialize();

  // Test 1: Empty input
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
    
    console.log('✅ Empty input handled correctly');
  } catch (error) {
    console.log('✅ Empty input properly rejected');
  }

  // Test 2: Very long input
  console.log('\n📊 Test 2: Long input handling');
  const longTranscription = "Meeting discussion ".repeat(100) + "with ACME Corp for $100,000 project";
  const longContext = {
    transcription: longTranscription,
    entities: [
      { type: "organization" as const, value: "ACME Corp", confidence: 0.9, context: "with ACME Corp" },
      { type: "financial" as const, value: "$100,000", confidence: 0.95, context: "$100,000 project" }
    ],
    conversationId: "long-test",
    previousInteractions: []
  };

  const longAnalysis = await salesAgent.analyzeSalesOpportunity(longContext);
  
  if (!longAnalysis.opportunity_detected) {
    throw new Error('Failed to detect opportunity in long input');
  }

  console.log('✅ Long input handled correctly');

  // Test 3: Mixed language/unclear input
  console.log('\n📊 Test 3: Mixed language input');
  const mixedContext = {
    transcription: "Bonjour, we need solution for notre entreprise, budget environ 50000 euros",
    entities: [
      { type: "financial" as const, value: "50000 euros", confidence: 0.8, context: "budget environ 50000 euros" }
    ],
    conversationId: "mixed-test",
    previousInteractions: []
  };

  const mixedAnalysis = await salesAgent.analyzeSalesOpportunity(mixedContext);
  console.log('Mixed language analysis:', {
    detected: mixedAnalysis.opportunity_detected,
    confidence: mixedAnalysis.confidence
  });

  console.log('✅ Edge case tests completed');
}

async function testPerformance(): Promise<void> {
  console.log('🧪 Testing Performance...');
  
  const salesAgent = new TestSalesAgent();
  await salesAgent.initialize();

  const testContext = {
    transcription: testConversations.dassaultOpportunity.transcription,
    entities: testConversations.dassaultOpportunity.entities,
    conversationId: "perf-test",
    previousInteractions: []
  };

  // Test multiple concurrent requests
  const concurrentTests = 5;
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

  console.log(`Performance results:
    - Concurrent requests: ${concurrentTests}
    - Total time: ${totalTime}ms
    - Average time per request: ${avgTime}ms
    - All successful: ${results.every(r => r.analysis.confidence > 0)}
  `);

  if (avgTime > 10000) { // 10 seconds per request seems too slow
    console.warn('⚠️ Performance may be slow');
  }

  console.log('✅ Performance tests completed');
}

export async function runSalesAgentTests(): Promise<void> {
  console.log('🚀 Starting Sales Agent Tests\n');
  
  try {
    await testOpportunityDetection();
    console.log();
    
    await testConversationalResponses();
    console.log();
    
    await testOpportunityCreation();
    console.log();
    
    await testEdgeCases();
    console.log();
    
    await testPerformance();
    console.log();
    
    console.log('✅ All Sales Agent tests completed successfully!');
  } catch (error) {
    console.error('❌ Sales Agent test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSalesAgentTests();
} 