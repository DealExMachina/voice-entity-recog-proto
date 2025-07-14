import { MastraAgent } from '../src/agents/mastra-agent.js';
import { McpService } from '../src/services/mcp-service.js';
import { initializeDatabase } from '../src/database/duckdb.js';
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

async function testMcpService(): Promise<void> {
  console.log('🧪 Testing MCP Service...');
  
  // Use in-memory database for testing to avoid file locking issues
  const originalDbPath = process.env.DB_PATH;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.DB_PATH = ':memory:';
  process.env.NODE_ENV = 'test';
  
  try {
    // Initialize database first
    await initializeDatabase();
  
  const mcpService = new McpService();
  await mcpService.initialize();
  
  // Test storing an entity
  const result = await mcpService.storeEntity({
    type: 'person',
    value: 'Test Person',
    confidence: 0.9,
    context: 'Testing context',
    source_conversation_id: '00000000-0000-0000-0000-000000000000',
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    }
  });
  
  console.log('Store entity result:', result);
  
  if (!result.success) {
    throw new Error('Failed to store entity');
  }
  
  // Test retrieving entities
  const entitiesResult = await mcpService.getEntities({ limit: 5 });
  console.log('Retrieved entities:', entitiesResult);
  
  console.log('✅ MCP service test completed');
  } finally {
    // Close database connection
    try {
      const { closeDatabase } = await import('../src/database/duckdb.js');
      await closeDatabase();
      console.log('🔌 Database connection closed');
    } catch (err) {
      console.log('⚠️ Could not close database:', err);
    }
    
    // Restore original environment variables
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }
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
    
    await testMcpService();
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