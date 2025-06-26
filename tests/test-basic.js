import { MastraAgent } from '../src/agents/mastra-agent.js';
import { McpService } from '../src/services/mcp-service.js';
import fs from 'fs';

// Mock OpenAI for testing
const mockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{
          message: {
            content: JSON.stringify([
              {
                type: "person",
                value: "John Smith",
                confidence: 0.95,
                context: "Meeting with John Smith"
              }
            ])
          }
        }]
      })
    }
  }
};

async function testEntityExtraction() {
  console.log('🧪 Testing Entity Extraction...');
  
  const agent = new MastraAgent();
  agent.openai = mockOpenAI; // Use mock for testing
  
  const testText = "Meeting with John Smith from Acme Corp next Tuesday at 3 PM";
  const entities = await agent.extractEntities(testText);
  
  console.log('Extracted entities:', entities);
  console.log('✅ Entity extraction test completed');
}

async function testMcpService() {
  console.log('🧪 Testing MCP Service...');
  
  const mcpService = new McpService();
  await mcpService.initialize();
  
  // Test storing an entity
  const result = await mcpService.storeEntity({
    type: 'person',
    value: 'Test Person',
    confidence: 0.9,
    context: 'Testing context'
  });
  
  console.log('Store entity result:', result);
  console.log('✅ MCP service test completed');
}

async function testSampleTexts() {
  console.log('🧪 Testing Sample Texts...');
  
  try {
    const sampleData = JSON.parse(fs.readFileSync('./examples/sample-texts.json', 'utf8'));
    console.log(`Loaded ${sampleData.conversations.length} sample conversations`);
    
    const agent = new MastraAgent();
    agent.openai = mockOpenAI; // Use mock for testing
    
    for (const conversation of sampleData.conversations.slice(0, 2)) {
      console.log(`\nProcessing: ${conversation.id}`);
      console.log(`Text: ${conversation.text.substring(0, 100)}...`);
      
      const entities = await agent.extractEntities(conversation.text);
      console.log(`Extracted ${entities.length} entities`);
      
      const analysis = await agent.analyzeEntities(entities);
      console.log(`Analysis: ${analysis.insights.join(', ')}`);
    }
    
    console.log('✅ Sample texts test completed');
  } catch (error) {
    console.error('❌ Sample texts test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Basic Tests\n');
  
  try {
    await testEntityExtraction();
    console.log();
    
    await testMcpService();
    console.log();
    
    await testSampleTexts();
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