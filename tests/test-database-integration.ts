import { 
  createTestDatabaseConnection, 
  initializeTestDatabase, 
  closeTestDatabase,
  insertEntityWithDb,
  getAllEntitiesWithDb,
  getEntitiesByTypeWithDb,
  insertConversationWithDb
} from '../src/database/duckdb.js';
import type { EntityType } from '../src/types/index.js';

// Declare process global for TypeScript
declare const process: {
  env: { NODE_ENV?: string };
  exit: (code?: number) => never;
  argv: string[];
};

async function testDatabaseIntegration(): Promise<void> {
  console.log('🧪 Testing Database Integration with Isolated Connections...');
  
  // Create isolated database connection
  const db = createTestDatabaseConnection();
  
  try {
    // Initialize fresh schema
    await initializeTestDatabase(db);
    console.log('✅ Database schema initialized');
    
    // Test entity insertion
    const entityId = await insertEntityWithDb(db, {
      type: 'person' as EntityType,
      value: 'Integration Test Person',
      confidence: 0.95,
      context: 'Testing database integration',
      source_conversation_id: '00000000-0000-0000-0000-000000000000',
      metadata: { test: true, timestamp: new Date().toISOString() }
    });
    
    console.log('✅ Entity inserted with ID:', entityId);
    
    // Test entity retrieval
    const allEntities = await getAllEntitiesWithDb(db, 10);
    console.log('✅ Retrieved all entities:', allEntities.length);
    
    const personEntities = await getEntitiesByTypeWithDb(db, 'person' as EntityType, 10);
    console.log('✅ Retrieved person entities:', personEntities.length);
    
    if (personEntities.length === 0) {
      throw new Error('No person entities found after insertion');
    }
    
    // Test conversation insertion
    const conversationId = await insertConversationWithDb(db, {
      transcription: 'Test conversation for database integration',
      audio_duration: 45.2,
      metadata: { test: true, source: 'integration-test' }
    });
    
    console.log('✅ Conversation inserted with ID:', conversationId);
    
    console.log('✅ Database integration test completed successfully');
    
  } finally {
    // Clean up
    await closeTestDatabase(db);
    console.log('🔌 Test database connection closed');
  }
}

async function testMultipleConnections(): Promise<void> {
  console.log('🧪 Testing Multiple Isolated Database Connections...');
  
  const connections: any[] = [];
  
  try {
    // Create multiple isolated connections
    for (let i = 0; i < 3; i++) {
      const db = createTestDatabaseConnection();
      connections.push(db);
      
      await initializeTestDatabase(db);
      
      // Insert unique entity in each connection
      await insertEntityWithDb(db, {
        type: 'person' as EntityType,
        value: `Test Person ${i + 1}`,
        confidence: 0.9 + (i * 0.01),
        context: `Connection ${i + 1} test`,
        source_conversation_id: '00000000-0000-0000-0000-000000000000',
        metadata: { connectionId: i + 1, test: true }
      });
      
      console.log(`✅ Connection ${i + 1} initialized and entity inserted`);
    }
    
    // Verify each connection has its own data
    for (let i = 0; i < connections.length; i++) {
      const entities = await getAllEntitiesWithDb(connections[i], 10);
      console.log(`✅ Connection ${i + 1} has ${entities.length} entities`);
      
      if (entities.length === 0) {
        throw new Error(`Connection ${i + 1} has no entities`);
      }
    }
    
    console.log('✅ Multiple connections test completed successfully');
    
  } finally {
    // Clean up all connections
    for (const db of connections) {
      await closeTestDatabase(db);
    }
    console.log('🔌 All test database connections closed');
  }
}

async function runDatabaseTests(): Promise<void> {
  console.log('🚀 Starting Database Integration Tests\n');
  
  try {
    await testDatabaseIntegration();
    console.log('\n---');
    await testMultipleConnections();
    console.log('\n✅ All database integration tests passed!');
  } catch (error) {
    console.error('\n❌ Database integration test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests();
}