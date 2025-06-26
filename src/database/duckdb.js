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
    if (params.length === 0) {
      database.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    } else {
      database.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    }
  });
}

export async function insertEntity(entity) {
  const sql = `
    INSERT INTO entities (type, value, confidence, context, source_conversation_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    entity.type,
    entity.value,
    entity.confidence,
    entity.context,
    entity.conversationId,
    JSON.stringify(entity.metadata || {})
  ];

  const result = await executeQuery(sql, params);
  return result[0]?.id;
}

export async function getEntitiesByType(type, limit = 100) {
  const sql = `
    SELECT * FROM entities 
    WHERE type = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery(sql, [type, limit]);
}

export async function getAllEntities(limit = 100) {
  const sql = `
    SELECT * FROM entities 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery(sql, [limit]);
}

export async function insertConversation(conversation) {
  const sql = `
    INSERT INTO conversations (transcription, audio_duration, metadata)
    VALUES (?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    conversation.transcription,
    conversation.audioDuration,
    JSON.stringify(conversation.metadata || {})
  ];

  const result = await executeQuery(sql, params);
  return result[0]?.id;
} 