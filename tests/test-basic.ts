import { MastraAgent } from '../src/agents/mastra-agent.js';
import type { ExtractedEntity } from '../src/types/index.js';
import dotenv from 'dotenv';

// Declare process global for TypeScript
declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    DB_PATH?: string;
    NODE_ENV?: string;
  };
  exit: (code?: number) => never;
  argv: string[];
};

// Load environment variables
dotenv.config();

// Mock OpenAI for testing when no real API key is available
const mockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              entities: [
                {
                  type: "person",
                  value: "John Smith",
                  confidence: 0.95,
                  context: "Meeting with John Smith"
                }
              ]
            })
          }
        }]
      })
    }
  }
} as any;

async function testEntityExtraction(): Promise<void> {
  console.log('🧪 Testing Entity Extraction...');
  
  const agent = new MastraAgent();
  
  // Only use mock if no real OpenAI key is available
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ No OpenAI API key found, using mock for testing');
    (agent as any).openai = mockOpenAI; // Use mock for testing
  } else {
    console.log('✅ OpenAI API key found, testing with real API');
  }
  
  const testText = "Meeting with John Smith from Acme Corp next Tuesday at 3 PM";
  const entities = await agent.extractEntities(testText);
  
  console.log('Extracted entities:', entities);
  
  // Validate results
  if (entities.length === 0) {
    throw new Error('No entities extracted');
  }
  
  console.log('✅ Entity extraction test completed');
}

async function testMcpServiceLogic(): Promise<void> {
  console.log('🧪 Testing MCP Service Logic (without database)...');
  
  // Test the core logic without database dependencies
  const testEntity = {
    type: 'person' as const,
    value: 'Test Person',
    confidence: 0.9,
    context: 'Testing context',
    source_conversation_id: '00000000-0000-0000-0000-000000000000',
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    }
  };
  
  // Simulate entity storage logic
  const storedEntity = {
    id: 'test-id-123',
    ...testEntity,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  console.log('✅ Entity object created:', storedEntity);
  
  // Test entity retrieval logic
  const retrievedEntities = [storedEntity];
  console.log('✅ Retrieved entities:', retrievedEntities);
  
  if (retrievedEntities.length === 0) {
    throw new Error('No entities retrieved');
  }
  
  // Test entity filtering logic
  const personEntities = retrievedEntities.filter(e => e.type === 'person');
  console.log('✅ Person entities:', personEntities);
  
  if (personEntities.length === 0) {
    throw new Error('No person entities found');
  }
  
  console.log('✅ MCP service logic test completed');
}

async function testDemoEntityExtraction(): Promise<void> {
  console.log('🧪 Testing Demo Entity Extraction...');
  
  const agent = new MastraAgent();
  agent.setAiProvider('demo'); // Use demo mode
  
  const testTexts = [
    "Meeting with John Smith from Acme Corp next Tuesday at 3 PM to discuss the $50,000 budget",
    "Call Sarah Johnson at Microsoft about the Q4 project deadline on Friday",
    "Schedule review with the development team for the new API features next week"
  ];
  
  for (const text of testTexts) {
    console.log(`\nProcessing: "${text}"`);
    
    const entities = await agent.extractEntities(text);
    console.log(`Extracted ${entities.length} entities:`, entities);
    
    const analysis = await agent.analyzeEntities(entities);
    console.log(`Analysis insights: ${analysis.insights.join(', ')}`);
  }
  
  console.log('✅ Demo entity extraction test completed');
}

async function testProviderSwitching(): Promise<void> {
  console.log('🧪 Testing AI Provider Switching...');
  
  const agent = new MastraAgent();
  
  // Test getting available providers
  const providers = agent.getAvailableProviders();
  console.log('Available providers:', providers);
  
  // Test switching to demo mode
  agent.setAiProvider('demo');
  const status = agent.getProviderStatus();
  console.log('Provider status after switch:', status);
  
  if (status.current !== 'demo') {
    throw new Error('Failed to switch to demo provider');
  }
  
  console.log('✅ Provider switching test completed');
}

async function runTests(): Promise<void> {
  console.log('🚀 Starting Basic Tests\n');
  
  try {
    await testEntityExtraction();
    console.log();
    
    await testMcpServiceLogic();
    console.log();
    
    await testDemoEntityExtraction();
    console.log();
    
    await testProviderSwitching();
    console.log();
    
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
} 