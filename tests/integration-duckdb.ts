import DuckDB from 'duckdb';
import fs from 'fs';

// Declare process global for TypeScript
declare const process: {
  env: { NODE_ENV?: string };
  exit: (code?: number) => never;
  argv: string[];
};

function getUniqueTestDbPath() {
  const uniqueId = Date.now() + Math.random().toString(36).substring(7);
  return `/tmp/integration-db-${uniqueId}.db`;
}

async function integrationTestDuckDb(): Promise<void> {
  console.log('🧪 DuckDB Full Integration Test...');
  const dbPath = getUniqueTestDbPath();
  const db = new DuckDB.Database(dbPath);
  try {
    // --- 1. Create full schema (copy from your DB module) ---
    const schemaSQL = `
      CREATE TABLE entities (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        type VARCHAR NOT NULL,
        value TEXT NOT NULL,
        confidence FLOAT,
        context TEXT,
        source_conversation_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSON
      );
      CREATE TABLE conversations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        transcription TEXT NOT NULL,
        audio_duration FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSON
      );
      CREATE TABLE entity_relationships (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        entity1_id UUID REFERENCES entities(id),
        entity2_id UUID REFERENCES entities(id),
        relationship_type VARCHAR,
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_entities_type ON entities(type);
      CREATE INDEX idx_entities_created_at ON entities(created_at);
      CREATE INDEX idx_conversations_created_at ON conversations(created_at);
      CREATE INDEX idx_entities_source_conversation ON entities(source_conversation_id);
    `;
    await new Promise<void>((resolve, reject) => {
      db.exec(schemaSQL, (err) => {
        if (err) {
          console.error('❌ Failed to create schema:', err.message);
          reject(new Error(`Failed to create schema: ${err.message}`));
        } else {
          console.log('✅ Schema created');
          resolve();
        }
      });
    });

    // --- 2. Insert an entity ---
    const insertEntitySQL = `INSERT INTO entities (type, value, confidence, context, source_conversation_id, metadata) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`;
    const entityParams = [
      'person',
      'Integration Test Person',
      0.99,
      'Integration context',
      null,
      JSON.stringify({ test: true })
    ];
    const entityId: string = await new Promise((resolve, reject) => {
      db.all(insertEntitySQL, ...entityParams, (err, rows) => {
        if (err) {
          console.error('❌ Failed to insert entity:', err.message);
          reject(new Error(`Failed to insert entity: ${err.message}`));
        } else {
          console.log('✅ Entity inserted:', rows[0]);
          resolve(rows[0].id);
        }
      });
    });

    // --- 3. Insert a conversation ---
    const insertConvSQL = `INSERT INTO conversations (transcription, audio_duration, metadata) VALUES (?, ?, ?) RETURNING id`;
    const convParams = [
      'Integration test conversation',
      42.0,
      JSON.stringify({ test: true })
    ];
    const conversationId: string = await new Promise((resolve, reject) => {
      db.all(insertConvSQL, ...convParams, (err, rows) => {
        if (err) {
          console.error('❌ Failed to insert conversation:', err.message);
          reject(new Error(`Failed to insert conversation: ${err.message}`));
        } else {
          console.log('✅ Conversation inserted:', rows[0]);
          resolve(rows[0].id);
        }
      });
    });

    // --- 4. Insert a relationship (foreign key test) ---
    const insertRelSQL = `INSERT INTO entity_relationships (entity1_id, entity2_id, relationship_type, confidence) VALUES (?, ?, ?, ?) RETURNING id`;
    const relParams = [entityId, entityId, 'self', 1.0];
    const relId: string = await new Promise((resolve, reject) => {
      db.all(insertRelSQL, ...relParams, (err, rows) => {
        if (err) {
          console.error('❌ Failed to insert relationship:', err.message);
          reject(new Error(`Failed to insert relationship: ${err.message}`));
        } else {
          console.log('✅ Relationship inserted:', rows[0]);
          resolve(rows[0].id);
        }
      });
    });

    // --- 5. Query entities ---
    await new Promise<void>((resolve, reject) => {
      db.all('SELECT * FROM entities WHERE type = ?', 'person', (err, rows) => {
        if (err) {
          console.error('❌ Failed to query entities:', err.message);
          reject(new Error(`Failed to query entities: ${err.message}`));
        } else {
          console.log('✅ Queried entities:', rows);
          if (!rows.length) reject(new Error('No entities found'));
          else resolve();
        }
      });
    });

    // --- 6. Query relationships ---
    await new Promise<void>((resolve, reject) => {
      db.all('SELECT * FROM entity_relationships WHERE entity1_id = ?', entityId, (err, rows) => {
        if (err) {
          console.error('❌ Failed to query relationships:', err.message);
          reject(new Error(`Failed to query relationships: ${err.message}`));
        } else {
          console.log('✅ Queried relationships:', rows);
          if (!rows.length) reject(new Error('No relationships found'));
          else resolve();
        }
      });
    });

    console.log('✅ Full DuckDB integration test completed successfully');
  } finally {
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) {
          console.error('❌ Failed to close DB:', err.message);
          reject(err);
        } else {
          console.log('🔌 Database connection closed');
          resolve();
        }
      });
    });
    // Clean up DB file
    try { fs.unlinkSync(dbPath); } catch {}
  }
}

async function runIntegrationTest(): Promise<void> {
  console.log('🚀 Starting DuckDB Integration Test\n');
  try {
    await integrationTestDuckDb();
    console.log('\n✅ DuckDB integration test passed!');
  } catch (error) {
    console.error('\n❌ DuckDB integration test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest();
}