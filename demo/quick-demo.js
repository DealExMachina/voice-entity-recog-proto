#!/usr/bin/env node

import { MastraAgent } from '../src/agents/mastra-agent.js';
import { McpService } from '../src/services/mcp-service.js';
import { initializeDatabase } from '../src/database/duckdb.js';

// Demo data
const demoConversations = [
  "Hi John, let's schedule a meeting with Acme Corp next Tuesday at 3 PM to discuss the $50,000 budget for Project Alpha.",
  "Good morning, this is Sarah from TechCorp. Our CEO Michael Johnson wants to finalize the $250,000 contract by December 15th.",
  "Customer complaint from Global Industries about delayed shipment to Chicago. Contact FastShip LLC before 5 PM today.",
  "Team standup with Engineering at 9:30 AM. David is handling backend, Emma frontend. Release date is January 31st."
];

async function runDemo() {
  console.log('🚀 Mastra Voice Entity Extraction Demo\n');
  
  try {
    // Initialize services
    console.log('📊 Initializing database...');
    await initializeDatabase();
    
    console.log('🔗 Starting MCP service...');
    const mcpService = new McpService();
    await mcpService.initialize();
    
    console.log('🤖 Initializing Mastra agent...');
    const mastraAgent = new MastraAgent();
    
    // Mock OpenAI for demo
    mastraAgent.openai = null; // Force fallback to demo patterns
    
    console.log('\n✅ All services initialized!\n');
    
    // Process each demo conversation
    for (let i = 0; i < demoConversations.length; i++) {
      const conversation = demoConversations[i];
      console.log(`📝 Processing conversation ${i + 1}:`);
      console.log(`"${conversation}"\n`);
      
      // Extract entities
      const entities = await mastraAgent.extractEntities(conversation);
      console.log(`🔍 Extracted ${entities.length} entities:`);
      
      entities.forEach(entity => {
        console.log(`  • ${entity.type.toUpperCase()}: ${entity.value} (${Math.round(entity.confidence * 100)}%)`);
      });
      
      // Store in database via MCP
      const conversationResult = await mcpService.storeConversation({
        transcription: conversation,
        audioDuration: 30,
        metadata: { source: 'demo' }
      });
      
      if (entities.length > 0) {
        await mcpService.storeEntities(entities.map(entity => ({
          ...entity,
          conversationId: conversationResult.conversationId
        })));
        console.log(`💾 Stored ${entities.length} entities in database`);
      }
      
      // Generate insights
      const analysis = await mastraAgent.analyzeEntities(entities);
      if (analysis.insights.length > 0) {
        console.log(`💡 Insights: ${analysis.insights.join(', ')}`);
      }
      
      console.log('\n' + '─'.repeat(60) + '\n');
    }
    
    // Show final statistics
    console.log('📈 Final Statistics:');
    const stats = await mcpService.getStats();
    console.log(`Total entities in database: ${stats.totalEntities}`);
    console.log('Entity breakdown:');
    Object.entries(stats.entityTypes).forEach(([type, count]) => {
      console.log(`  • ${type}: ${count}`);
    });
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\nTo see the web interface:');
    console.log('1. Run: npm run dev');
    console.log('2. Open: http://localhost:3000');
    console.log('3. Try the voice recording or text input features');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
runDemo(); 