import Database from 'duckdb';
import fs from 'fs';
import path from 'path';

let db;

export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DB_PATH || './data/entities.db';
    const dbDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize DuckDB
    db = new Database.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create tables
      const createTablesSQL = `
        -- Entities table
        CREATE TABLE IF NOT EXISTS entities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type VARCHAR NOT NULL,
          value TEXT NOT NULL,
          confidence FLOAT,
          context TEXT,
          source_conversation_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Conversations table
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          transcription TEXT NOT NULL,
          audio_duration FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Entity relationships table
        CREATE TABLE IF NOT EXISTS entity_relationships (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          entity1_id UUID REFERENCES entities(id),
          entity2_id UUID REFERENCES entities(id),
          relationship_type VARCHAR,
          confidence FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
        CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
        CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      `;

      db.exec(createTablesSQL, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📊 Database tables created successfully');
          resolve();
        }
      });
    });
  });
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    console.log('🔍 executeQuery called with:');
    console.log('  SQL:', sql);
    console.log('  Params:', params);
    console.log('  Param count:', params.length);
    console.log('  Param types:', params.map(p => typeof p));
    
    if (params.length === 0) {
      database.all(sql, (err, rows) => {
        if (err) {
          console.error('🔍 executeQuery error (no params):', err);
          reject(err);
        } else {
          console.log('🔍 executeQuery success (no params):', rows);
          resolve(rows);
        }
      });
    } else {
      database.all(sql, params, (err, rows) => {
        if (err) {
          console.error('🔍 executeQuery error (with params):', err);
          reject(err);
        } else {
          console.log('🔍 executeQuery success (with params):', rows);
          resolve(rows);
        }
      });
    }
  });
}

// Test function to validate parameter binding
export async function testParameterBinding() {
  const sql = 'SELECT ? as param1, ? as param2, ? as param3';
  const params = ['test1', 'test2', 'test3'];
  
  try {
    const result = await executeQuery(sql, params);
    console.log('✅ Parameter binding test successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Parameter binding test failed:', error);
    throw error;
  }
}

export async function insertConversation(conversation) {
  console.log('🔍 insertConversation called with:', JSON.stringify(conversation, null, 2));
  
  // DuckDB uses $1, $2, $3 syntax for parameters, not ?
  const sql = `
    INSERT INTO conversations (transcription, audio_duration, metadata)
    VALUES ($1, $2, $3)
    RETURNING id
  `;
  
  // Ensure all parameters are properly defined and not undefined
  const transcription = String(conversation.transcription || '');
  const audioDuration = conversation.audioDuration === null ? null : Number(conversation.audioDuration || 0);
  const metadata = JSON.stringify(conversation.metadata || {});
  
  const params = [transcription, audioDuration, metadata];

  console.log('🔍 insertConversation SQL:', sql);
  console.log('🔍 insertConversation params:', params);

  try {
    const result = await executeQuery(sql, params);
    console.log('🔍 insertConversation result:', result);
    return result[0]?.id;
  } catch (error) {
    console.error('🔍 insertConversation error:', error);
    throw error;
  }
}

export async function insertEntity(entity) {
  console.log('🔍 insertEntity called with:', JSON.stringify(entity, null, 2));
  
  // DuckDB uses $1, $2, $3, $4, $5, $6 syntax for parameters, not ?
  const sql = `
    INSERT INTO entities (type, value, confidence, context, source_conversation_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  
  // Ensure all parameters are properly defined
  const type = entity.type || 'unknown';
  const value = entity.value || '';
  const confidence = entity.confidence || 0.8;
  const context = entity.context || '';
  const conversationId = entity.conversationId === null ? null : entity.conversationId;
  const metadata = JSON.stringify(entity.metadata || {});
  
  const params = [type, value, confidence, context, conversationId, metadata];

  console.log('🔍 insertEntity SQL:', sql);
  console.log('🔍 insertEntity params:', params);

  try {
    const result = await executeQuery(sql, params);
    console.log('🔍 insertEntity result:', result);
    return result[0]?.id;
  } catch (error) {
    console.error('🔍 insertEntity error:', error);
    throw error;
  }
}

export async function getEntitiesByType(type, limit = 100) {
  const sql = `
    SELECT * FROM entities 
    WHERE type = $1 
    ORDER BY created_at DESC 
    LIMIT $2
  `;
  return executeQuery(sql, [type, limit]);
}

export async function getAllEntities(limit = 100) {
  const sql = `
    SELECT * FROM entities 
    ORDER BY created_at DESC 
    LIMIT $1
  `;
  return executeQuery(sql, [limit]);
} 