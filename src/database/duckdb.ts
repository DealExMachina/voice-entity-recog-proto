import DuckDB from 'duckdb';
import fs from 'fs';
import path from 'path';
import type { 
  Entity, 
  Conversation, 
  EntityType, 
  DatabaseConfig,
  DatabaseConnection 
} from '../types/index.js';

let db: import('duckdb').Database | null = null;

export async function initializeDatabase(config?: DatabaseConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = config?.path || process.env.DB_PATH || './data/entities.db';
    const dbDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize DuckDB
    db = new DuckDB.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Failed to initialize database: ${err.message}`));
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Conversations table
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          transcription TEXT NOT NULL,
          audio_duration FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Personas table
        CREATE TABLE IF NOT EXISTS personas (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR NOT NULL,
          description TEXT,
          voice JSON,
          personality JSON,
          expertise JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        CREATE INDEX IF NOT EXISTS idx_entities_source_conversation ON entities(source_conversation_id);
        CREATE INDEX IF NOT EXISTS idx_personas_name ON personas(name);

        -- Email integration tables
        CREATE TABLE IF NOT EXISTS email_accounts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          provider VARCHAR NOT NULL, -- 'gmail', 'outlook', 'imap'
          email VARCHAR NOT NULL UNIQUE,
          display_name VARCHAR,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at TIMESTAMP,
          settings JSON,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS emails (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          account_id UUID REFERENCES email_accounts(id),
          external_id VARCHAR, -- Email provider's message ID
          thread_id VARCHAR,
          subject VARCHAR,
          sender VARCHAR,
          recipients JSON, -- Array of email addresses
          cc JSON,
          bcc JSON,
          body_text TEXT,
          body_html TEXT,
          received_at TIMESTAMP,
          sent_at TIMESTAMP,
          is_read BOOLEAN DEFAULT false,
          is_important BOOLEAN DEFAULT false,
          labels JSON,
          attachments JSON,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Calendar integration tables
        CREATE TABLE IF NOT EXISTS calendar_accounts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          provider VARCHAR NOT NULL, -- 'google', 'outlook', 'ical'
          email VARCHAR NOT NULL,
          display_name VARCHAR,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at TIMESTAMP,
          calendar_id VARCHAR, -- Provider's calendar ID
          settings JSON,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS calendar_events (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          account_id UUID REFERENCES calendar_accounts(id),
          external_id VARCHAR, -- Calendar provider's event ID
          title VARCHAR NOT NULL,
          description TEXT,
          location VARCHAR,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          timezone VARCHAR,
          attendees JSON, -- Array of attendee objects
          organizer VARCHAR,
          is_all_day BOOLEAN DEFAULT false,
          recurrence JSON, -- Recurrence rules
          status VARCHAR, -- 'confirmed', 'tentative', 'cancelled'
          visibility VARCHAR, -- 'public', 'private', 'default'
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Client/Entity relationship tracking
        CREATE TABLE IF NOT EXISTS client_communications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          entity_id UUID REFERENCES entities(id),
          communication_type VARCHAR NOT NULL, -- 'email', 'calendar', 'voice', 'meeting'
          external_id VARCHAR, -- ID from email/calendar system
          subject VARCHAR,
          content TEXT,
          participants JSON, -- Array of participant objects
          occurred_at TIMESTAMP,
          direction VARCHAR, -- 'inbound', 'outbound'
          status VARCHAR, -- 'sent', 'received', 'scheduled', 'completed'
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Meeting scheduling and tracking
        CREATE TABLE IF NOT EXISTS scheduled_meetings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title VARCHAR NOT NULL,
          description TEXT,
          entity_ids JSON, -- Array of related entity IDs
          proposed_times JSON, -- Array of proposed time slots
          confirmed_time TIMESTAMP,
          duration_minutes INTEGER DEFAULT 60,
          meeting_type VARCHAR, -- 'sales_call', 'demo', 'follow_up', 'discovery'
          status VARCHAR, -- 'proposed', 'confirmed', 'completed', 'cancelled'
          calendar_event_id UUID REFERENCES calendar_events(id),
          email_thread_id VARCHAR,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for new tables
        CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
        CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
        CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
        CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_account_id ON calendar_events(account_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
        CREATE INDEX IF NOT EXISTS idx_calendar_events_external_id ON calendar_events(external_id);
        CREATE INDEX IF NOT EXISTS idx_client_communications_entity_id ON client_communications(entity_id);
        CREATE INDEX IF NOT EXISTS idx_client_communications_type ON client_communications(communication_type);
        CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_entity_ids ON scheduled_meetings USING GIN(entity_ids);
        CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_status ON scheduled_meetings(status);
      `;

      db!.exec(createTablesSQL, (err) => {
        if (err) {
          reject(new Error(`Failed to create tables: ${err.message}`));
        } else {
          console.log('📊 Database tables created successfully');
          resolve();
        }
      });
    });
  });
}

export function getDatabase(): import('duckdb').Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function executeQuery<T = unknown>(
  sql: string, 
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    const callback = (err: Error | null, rows: T[]) => {
      if (err) {
        reject(new Error(`Query failed: ${err.message}`));
      } else {
        resolve(rows || []);
      }
    };

    if (params.length === 0) {
      database.all(sql, callback);
    } else {
      (database.all as any)(sql, ...params, callback);
    }
  });
}

interface InsertEntityParams {
  type: EntityType;
  value: string;
  confidence: number;
  context: string;
  source_conversation_id: string;
  metadata: Record<string, unknown>;
}

export async function insertEntity(entity: InsertEntityParams): Promise<string> {
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
    entity.source_conversation_id,
    JSON.stringify(entity.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert entity - no ID returned');
  }
  
  return result[0].id;
}

export async function getEntitiesByType(
  type: EntityType, 
  limit: number = 100
): Promise<Entity[]> {
  const sql = `
    SELECT * FROM entities 
    WHERE type = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<Entity>(sql, [type, limit]);
}

export async function getAllEntities(limit: number = 100): Promise<Entity[]> {
  const sql = `
    SELECT * FROM entities 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<Entity>(sql, [limit]);
}

export async function getEntitiesByConversation(
  conversationId: string
): Promise<Entity[]> {
  const sql = `
    SELECT * FROM entities 
    WHERE source_conversation_id = ?
    ORDER BY created_at ASC
  `;
  return executeQuery<Entity>(sql, [conversationId]);
}

interface InsertConversationParams {
  transcription: string;
  audio_duration: number;
  metadata: Record<string, unknown>;
}

export async function insertConversation(
  conversation: InsertConversationParams
): Promise<string> {
  const sql = `
    INSERT INTO conversations (transcription, audio_duration, metadata)
    VALUES (?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    conversation.transcription,
    conversation.audio_duration,
    JSON.stringify(conversation.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert conversation - no ID returned');
  }
  
  return result[0].id;
}

export async function getConversations(limit: number = 50): Promise<Conversation[]> {
  const sql = `
    SELECT * FROM conversations 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<Conversation>(sql, [limit]);
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const sql = `
    SELECT * FROM conversations 
    WHERE id = ?
  `;
  const result = await executeQuery<Conversation>(sql, [id]);
  return result[0] || null;
}

export async function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    
    db.close((err) => {
      if (err) {
        reject(new Error(`Failed to close database: ${err.message}`));
      } else {
        db = null;
        console.log('📊 Database connection closed');
        resolve();
      }
    });
  });
}

// Database connection helper for MCP integration
export function createDatabaseConnection(): DatabaseConnection {
  return {
    query: async <T = unknown>(sql: string, params?: Record<string, unknown>): Promise<T[]> => {
      const paramArray = params ? Object.values(params) : [];
      return executeQuery<T>(sql, paramArray);
    },
    close: closeDatabase
  };
} 

export async function insertPersona(persona: {
  name: string;
  description: string;
  voice: Record<string, unknown>;
  personality: Record<string, unknown>;
  expertise: string[];
}): Promise<string> {
  const sql = `
    INSERT INTO personas (name, description, voice, personality, expertise)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    persona.name,
    persona.description,
    JSON.stringify(persona.voice),
    JSON.stringify(persona.personality),
    JSON.stringify(persona.expertise)
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert persona - no ID returned');
  }
  
  return result[0].id;
}

export async function getPersonas(): Promise<any[]> {
  const sql = `
    SELECT * FROM personas 
    ORDER BY created_at DESC
  `;
  return executeQuery(sql);
}

export async function getPersonaById(id: string): Promise<any | null> {
  const sql = `
    SELECT * FROM personas 
    WHERE id = ?
  `;
  const result = await executeQuery(sql, [id]);
  return result[0] || null;
}

export async function updatePersona(id: string, persona: {
  name: string;
  description: string;
  voice: Record<string, unknown>;
  personality: Record<string, unknown>;
  expertise: string[];
}): Promise<void> {
  const sql = `
    UPDATE personas 
    SET name = ?, description = ?, voice = ?, personality = ?, expertise = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  const params = [
    persona.name,
    persona.description,
    JSON.stringify(persona.voice),
    JSON.stringify(persona.personality),
    JSON.stringify(persona.expertise),
    id
  ];

  await executeQuery(sql, params);
}

export async function deletePersona(id: string): Promise<void> {
  const sql = `DELETE FROM personas WHERE id = ?`;
  await executeQuery(sql, [id]);
} 