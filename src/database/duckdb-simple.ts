import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import fs from 'fs';
import path from 'path';

// Simple type definitions for our domain models
export interface Entity {
  id?: string;
  type: string;
  value: string;
  confidence: number;
  context: string;
  source_conversation_id?: string | null;
  created_at?: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id?: string;
  transcription: string;
  audio_duration?: number | null;
  created_at?: Date;
  metadata?: Record<string, any>;
}

// Database connection manager
class DuckDBManager {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;

  async initialize(): Promise<void> {
    const dbPath = process.env.DB_PATH || './data/entities.db';
    const dbDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create DuckDB instance
    this.instance = await DuckDBInstance.create(dbPath);
    this.connection = await this.instance.connect();

    // Create tables with proper schema
    await this.createTables();
    console.log('📊 Database tables created successfully');
  }

  private async createTables(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

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

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
    `;

    await this.connection.run(createTablesSQL);
  }

  getConnection(): DuckDBConnection {
    if (!this.connection) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.closeSync();
    }
  }
}

// Singleton instance
const dbManager = new DuckDBManager();

// Helper function to convert DuckDB values to plain JavaScript
function convertDuckDBValue(value: any): any {
  if (value && typeof value === 'object' && 'toString' in value) {
    return value.toString();
  }
  return value;
}

function convertDuckDBRow(row: any): any {
  const converted: any = {};
  for (const [key, value] of Object.entries(row)) {
    converted[key] = convertDuckDBValue(value);
  }
  return converted;
}

// Public API functions
export async function initializeDatabase(): Promise<void> {
  await dbManager.initialize();
}

export function getDatabase(): DuckDBConnection {
  return dbManager.getConnection();
}

export async function closeDatabase(): Promise<void> {
  await dbManager.close();
}

// Type-safe query functions with proper value conversion
export async function insertConversation(conversation: Omit<Conversation, 'id' | 'created_at'>): Promise<string> {
  const connection = getDatabase();
  
  console.log('🔍 insertConversation called with:', JSON.stringify(conversation, null, 2));
  
  const sql = `
    INSERT INTO conversations (transcription, audio_duration, metadata)
    VALUES ($transcription, $audio_duration, $metadata)
    RETURNING id
  `;
  
  const params = {
    transcription: conversation.transcription,
    audio_duration: conversation.audio_duration ?? null,
    metadata: JSON.stringify(conversation.metadata || {})
  };

  console.log('🔍 insertConversation SQL:', sql);
  console.log('🔍 insertConversation params:', params);

  try {
    const result = await connection.run(sql, params);
    const reader = await result.getRowObjects();
    const row = convertDuckDBRow(reader[0]);
    const id = row.id;
    
    console.log('🔍 insertConversation result:', id);
    return id;
  } catch (error) {
    console.error('🔍 insertConversation error:', error);
    throw error;
  }
}

export async function insertEntity(entity: Omit<Entity, 'id' | 'created_at'>): Promise<string> {
  const connection = getDatabase();
  
  console.log('🔍 insertEntity called with:', JSON.stringify(entity, null, 2));
  
  const sql = `
    INSERT INTO entities (type, value, confidence, context, source_conversation_id, metadata)
    VALUES ($type, $value, $confidence, $context, $source_conversation_id, $metadata)
    RETURNING id
  `;
  
  const params = {
    type: entity.type,
    value: entity.value,
    confidence: entity.confidence,
    context: entity.context,
    source_conversation_id: entity.source_conversation_id ?? null,
    metadata: JSON.stringify(entity.metadata || {})
  };

  console.log('🔍 insertEntity SQL:', sql);
  console.log('🔍 insertEntity params:', params);

  try {
    const result = await connection.run(sql, params);
    const reader = await result.getRowObjects();
    const row = convertDuckDBRow(reader[0]);
    const id = row.id;
    
    console.log('🔍 insertEntity result:', id);
    return id;
  } catch (error) {
    console.error('🔍 insertEntity error:', error);
    throw error;
  }
}

export async function getEntitiesByType(type: string, limit: number = 100): Promise<Entity[]> {
  const connection = getDatabase();
  
  const sql = `
    SELECT * FROM entities 
    WHERE type = $type
    ORDER BY created_at DESC 
    LIMIT $limit
  `;
  
  const result = await connection.run(sql, { type, limit });
  const rawEntities = await result.getRowObjects();
  
  return rawEntities.map(row => {
    const converted = convertDuckDBRow(row);
    return {
      ...converted,
      metadata: typeof converted.metadata === 'string' ? JSON.parse(converted.metadata) : converted.metadata
    } as Entity;
  });
}

export async function getAllEntities(limit: number = 100): Promise<Entity[]> {
  const connection = getDatabase();
  
  const sql = `
    SELECT * FROM entities 
    ORDER BY created_at DESC 
    LIMIT $limit
  `;
  
  const result = await connection.run(sql, { limit });
  const rawEntities = await result.getRowObjects();
  
  return rawEntities.map(row => {
    const converted = convertDuckDBRow(row);
    return {
      ...converted,
      metadata: typeof converted.metadata === 'string' ? JSON.parse(converted.metadata) : converted.metadata
    } as Entity;
  });
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const connection = getDatabase();
  
  const sql = `SELECT * FROM conversations WHERE id = $id`;
  const result = await connection.run(sql, { id });
  const rawConversations = await result.getRowObjects();
  
  if (rawConversations.length === 0) {
    return null;
  }
  
  const converted = convertDuckDBRow(rawConversations[0]);
  return {
    ...converted,
    metadata: typeof converted.metadata === 'string' ? JSON.parse(converted.metadata) : converted.metadata
  } as Conversation;
}

// Test function with proper value conversion
export async function testParameterBinding(): Promise<{ param1: string; param2: string; param3: string }[]> {
  const connection = getDatabase();
  
  const sql = 'SELECT $param1 as param1, $param2 as param2, $param3 as param3';
  const params = { param1: 'test1', param2: 'test2', param3: 'test3' };
  
  try {
    const result = await connection.run(sql, params);
    const rawData = await result.getRowObjects();
    const data = rawData.map(row => convertDuckDBRow(row)) as { param1: string; param2: string; param3: string }[];
    console.log('✅ Parameter binding test successful:', data);
    return data;
  } catch (error) {
    console.error('❌ Parameter binding test failed:', error);
    throw error;
  }
} 