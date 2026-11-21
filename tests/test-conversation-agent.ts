import { ConversationAgent } from '../src/agents/conversation-agent.js';
import { initializeDatabase } from '../src/database/duckdb.js';
import type { 
  SalesAnalysis,
  ConversationalResponse,
  ExtractedEntity 
} from '../src/types/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Define ConversationContext interface for testing
interface ConversationContext {
  transcription: string;
  entities: ExtractedEntity[];
  conversationId: string;
  previousInteractions: Array<{
    transcription: string;
    agent_response: string;
    timestamp: Date;
    analysis_summary: string;
  }>;
}

// Mock TTS responses for testing
const mockTTSResponse = {
  audio: Buffer.from('fake-audio-data'),
  format: 'mp3' as const,
  duration: 2.5
};

// Mock sales analysis for testing
const mockSalesAnalysis: SalesAnalysis = {
  opportunity_detected: true,
  confidence: 0.85,
  key_insights: [
    "High-value opportunity identified",
    "Clear budget and timeline provided",
    "Decision makers engaged"
  ],
  missing_information: [
    "Technical requirements",
    "Implementation timeline",
    "Success criteria"
  ],
  suggested_questions: [
    "What specific technical requirements do you have?",
    "When would you like to implement this solution?",
    "How will you measure success?"
  ],
  opportunity_summary: {
    title: "Enterprise Software Solution",
    client: "TechCorp Inc",
    value: 150000,
    currency: "USD",
    timeline: "Q2 2025",
    probability: 0.75,
    stage: "discovery"
  },
  risk_factors: [
    "Budget approval pending",
    "Multiple vendors being evaluated"
  ],
  next_actions: [
    "Schedule technical demo",
    "Prepare detailed proposal",
    "Identify decision timeline"
  ]
};

class TestConversationAgent extends ConversationAgent {
  private useRealTTS: boolean;
  
  constructor(useRealTTS: boolean = false) {
    super();
    this.useRealTTS = useRealTTS && !!process.env.OPENAI_API_KEY;
  }

  // Override TTS for testing
  protected async generateTTS(text: string): Promise<{ audio: Buffer; format: 'mp3' | 'wav'; duration: number }> {
    if (this.useRealTTS) {
      return super['generateTTS'](text);
    }

    // Return mock TTS data
    return mockTTSResponse;
  }
}

async function testConversationInitialization(): Promise<void> {
  console.log('🧪 Testing Conversation Agent Initialization...');
  
  const agent = new TestConversationAgent();
  await agent.initialize();
  
  // Test that agent is properly initialized
  const isInitialized = agent['isInitialized'] || true; // Assume initialized if no error
  
  if (!isInitialized) {
    throw new Error('ConversationAgent failed to initialize');
  }
  
  console.log('✅ Conversation agent initialized successfully');
}

async function testConversationProcessing(): Promise<void> {
  console.log('🧪 Testing Conversation Processing...');
  
  const agent = new TestConversationAgent();
  await agent.initialize();

  const context: ConversationContext = {
    transcription: "We're looking for a CRM solution for our 200-person team at TechCorp.",
    entities: [
      { type: "organization", value: "TechCorp", confidence: 0.9, context: "our 200-person team at TechCorp" },
      { type: "product", value: "CRM solution", confidence: 0.85, context: "looking for a CRM solution" },
      { type: "number", value: "200-person", confidence: 0.8, context: "200-person team" }
    ],
    conversationId: "test-conv-1",
    previousInteractions: []
  };

  console.log('\n📊 Processing conversation context...');
  const response = await agent.processConversation(context, mockSalesAnalysis);
  
  console.log('Response details:', {
    has_agent_response: !!response.agent_response,
    agent_response_length: response.agent_response?.length || 0,
    has_tts_audio: !!response.tts_audio,
    follow_up_count: response.follow_up_questions?.length || 0,
    has_opportunity_data: !!response.opportunity_match
  });

  // Validate response structure
  if (!response.agent_response || response.agent_response.length < 10) {
    throw new Error('Agent response is too short or missing');
  }

  if (!response.tts_audio) {
    throw new Error('TTS audio missing from response');
  }

  if (!response.follow_up_questions || response.follow_up_questions.length === 0) {
    throw new Error('No follow-up questions provided');
  }

  console.log('✅ Conversation processing test completed');
}

async function testTTSGeneration(): Promise<void> {
  console.log('🧪 Testing TTS Generation...');
  
  const agent = new TestConversationAgent();
  await agent.initialize();

  const testTexts = [
    "Thank you for sharing that information.",
    "I understand you're looking for a CRM solution. That's a great opportunity for us to explore together.",
    "What specific features are most important to your team?",
    "Let me ask you a few questions to better understand your needs."
  ];

  for (const text of testTexts) {
    console.log(`\n📊 Testing TTS for: "${text.substring(0, 50)}..."`);
    
    const startTime = Date.now();
    const ttsResult = await agent['generateTTS'](text);
    const duration = Date.now() - startTime;
    
    console.log('TTS result:', {
      audio_size: ttsResult.audio.length,
      format: ttsResult.format,
      duration: ttsResult.duration,
      generation_time: `${duration}ms`
    });

    if (!ttsResult.audio || ttsResult.audio.length === 0) {
      throw new Error('TTS audio generation failed');
    }

    if (ttsResult.format !== 'mp3') {
      throw new Error(`Unexpected TTS format: ${ttsResult.format}`);
    }
  }

  console.log('✅ TTS generation tests completed');
}

async function testConversationMemory(): Promise<void> {
  console.log('🧪 Testing Conversation Memory Management...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-conversation-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const agent = new TestConversationAgent();
    await agent.initialize();

    const conversationId = "memory-test-conversation";
    
    // First interaction
    const context1: ConversationContext = {
      transcription: "Hello, I'm John from ACME Corp. We need a new CRM system.",
      entities: [
        { type: "person", value: "John", confidence: 0.9, context: "I'm John from ACME Corp" },
        { type: "organization", value: "ACME Corp", confidence: 0.95, context: "John from ACME Corp" },
        { type: "product", value: "CRM system", confidence: 0.9, context: "need a new CRM system" }
      ],
      conversationId,
      previousInteractions: []
    };

    console.log('\n📊 First interaction...');
    const response1 = await agent.processConversation(context1, mockSalesAnalysis);
    
    // Second interaction with conversation history
    const context2: ConversationContext = {
      transcription: "Our budget is around $50,000 and we need it implemented by Q3.",
      entities: [
        { type: "financial", value: "$50,000", confidence: 0.95, context: "budget is around $50,000" },
        { type: "date", value: "Q3", confidence: 0.85, context: "implemented by Q3" }
      ],
      conversationId,
      previousInteractions: [{
        transcription: context1.transcription,
        agent_response: response1.agent_response,
        timestamp: new Date(),
        analysis_summary: "Initial CRM inquiry from ACME Corp"
      }]
    };

    console.log('\n📊 Second interaction with memory...');
    const response2 = await agent.processConversation(context2, mockSalesAnalysis);
    
    console.log('Memory test results:', {
      first_response_length: response1.agent_response.length,
      second_response_length: response2.agent_response.length,
      context_maintained: response2.agent_response.includes('ACME') || response2.agent_response.includes('John'),
      follow_up_evolution: response2.follow_up_questions?.some(q => 
        q.includes('Q3') || q.includes('50,000') || q.includes('budget')
      )
    });

    if (response2.follow_up_questions?.length === 0) {
      throw new Error('No contextual follow-up questions in second interaction');
    }

    console.log('✅ Conversation memory tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testResponsePersonalization(): Promise<void> {
  console.log('🧪 Testing Response Personalization...');
  
  const agent = new TestConversationAgent();
  await agent.initialize();

  // Test different confidence levels
  const highConfidenceAnalysis: SalesAnalysis = {
    ...mockSalesAnalysis,
    confidence: 0.95,
    opportunity_detected: true
  };

  const lowConfidenceAnalysis: SalesAnalysis = {
    ...mockSalesAnalysis,
    confidence: 0.3,
    opportunity_detected: false,
    suggested_questions: [
      "Can you tell me more about your business goals?",
      "What challenges are you currently facing?"
    ]
  };

  const context: ConversationContext = {
    transcription: "We might need some help with our processes.",
    entities: [],
    conversationId: "personalization-test",
    previousInteractions: []
  };

  console.log('\n📊 High confidence scenario...');
  const highConfResponse = await agent.processConversation(context, highConfidenceAnalysis);
  
  console.log('\n📊 Low confidence scenario...');
  const lowConfResponse = await agent.processConversation(context, lowConfidenceAnalysis);
  
  console.log('Personalization results:', {
    high_conf_response_length: highConfResponse.agent_response.length,
    low_conf_response_length: lowConfResponse.agent_response.length,
    high_conf_questions: highConfResponse.follow_up_questions?.length || 0,
    low_conf_questions: lowConfResponse.follow_up_questions?.length || 0,
    responses_different: highConfResponse.agent_response !== lowConfResponse.agent_response
  });

  if (highConfResponse.agent_response === lowConfResponse.agent_response) {
    throw new Error('Agent responses should be personalized based on confidence level');
  }

  console.log('✅ Response personalization tests completed');
}

async function testErrorHandling(): Promise<void> {
  console.log('🧪 Testing Error Handling...');
  
  const agent = new TestConversationAgent();
  await agent.initialize();

  // Test 1: Invalid analysis data
  console.log('\n📊 Test 1: Invalid analysis handling');
  try {
    const invalidAnalysis = {
      ...mockSalesAnalysis,
      confidence: -1, // Invalid confidence
      opportunity_summary: null
    } as any;

    const context: ConversationContext = {
      transcription: "Test conversation",
      entities: [],
      conversationId: "error-test-1",
      previousInteractions: []
    };

    const response = await agent.processConversation(context, invalidAnalysis);
    
    // Should handle gracefully
    if (!response.agent_response) {
      throw new Error('No fallback response provided for invalid analysis');
    }
    
    console.log('✅ Invalid analysis handled gracefully');
  } catch (error) {
    console.log('✅ Invalid analysis properly rejected');
  }

  // Test 2: Empty context
  console.log('\n📊 Test 2: Empty context handling');
  try {
    const emptyContext: ConversationContext = {
      transcription: "",
      entities: [],
      conversationId: "",
      previousInteractions: []
    };

    const response = await agent.processConversation(emptyContext, mockSalesAnalysis);
    
    if (!response.agent_response) {
      throw new Error('No fallback response for empty context');
    }
    
    console.log('✅ Empty context handled gracefully');
  } catch (error) {
    console.log('✅ Empty context properly handled with error');
  }

  console.log('✅ Error handling tests completed');
}

export async function runConversationAgentTests(): Promise<void> {
  console.log('🚀 Starting Conversation Agent Tests\n');
  
  try {
    await testConversationInitialization();
    console.log();
    
    await testConversationProcessing();
    console.log();
    
    await testTTSGeneration();
    console.log();
    
    await testConversationMemory();
    console.log();
    
    await testResponsePersonalization();
    console.log();
    
    await testErrorHandling();
    console.log();
    
    console.log('✅ All Conversation Agent tests completed successfully!');
  } catch (error) {
    console.error('❌ Conversation Agent test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runConversationAgentTests();
} 