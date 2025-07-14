import DuckDB from 'duckdb';
import fs from 'fs';
import path from 'path';
import type { 
  Entity, 
  Conversation, 
  EntityType, 
  DatabaseConfig 
} from '../types/index.js';
import type { 
  DatabaseProvider, 
  InsertEntityParams, 
  InsertConversationParams, 
  PersonaParams 
} from '../interfaces/database.js';

export class DuckDBProvider implements DatabaseProvider {
  private db: import('duckdb').Database | null = null;

  async initialize(config?: DatabaseConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const dbPath = config?.path || process.env.DB_PATH || './data/entities.db';
      const dbDir = path.dirname(dbPath);
      
      // Ensure data directory exists
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize DuckDB
      this.db = new DuckDB.Database(dbPath, (err) => {
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
            provider VARCHAR NOT NULL,
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
            external_id VARCHAR,
            thread_id VARCHAR,
            subject VARCHAR,
            sender VARCHAR,
            recipients JSON,
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
            provider VARCHAR NOT NULL,
            email VARCHAR NOT NULL,
            display_name VARCHAR,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TIMESTAMP,
            calendar_id VARCHAR,
            settings JSON,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS calendar_events (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            account_id UUID REFERENCES calendar_accounts(id),
            external_id VARCHAR,
            title VARCHAR NOT NULL,
            description TEXT,
            location VARCHAR,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            timezone VARCHAR,
            attendees JSON,
            organizer VARCHAR,
            is_all_day BOOLEAN DEFAULT false,
            recurrence JSON,
            status VARCHAR,
            visibility VARCHAR,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          -- Client/Entity relationship tracking
          CREATE TABLE IF NOT EXISTS client_communications (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            entity_id UUID REFERENCES entities(id),
            communication_type VARCHAR NOT NULL,
            external_id VARCHAR,
            subject VARCHAR,
            content TEXT,
            participants JSON,
            occurred_at TIMESTAMP,
            direction VARCHAR,
            status VARCHAR,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          -- Meeting scheduling and tracking
          CREATE TABLE IF NOT EXISTS scheduled_meetings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title VARCHAR NOT NULL,
            description TEXT,
            entity_ids JSON,
            proposed_times JSON,
            confirmed_time TIMESTAMP,
            duration_minutes INTEGER DEFAULT 60,
            meeting_type VARCHAR,
            status VARCHAR,
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

        this.db!.exec(createTablesSQL, (err) => {
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

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      
      this.db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close database: ${err.message}`));
        } else {
          this.db = null;
          console.log('📊 Database connection closed');
          resolve();
        }
      });
    });
  }

  async executeQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const callback = (err: Error | null, rows: T[]) => {
        if (err) {
          reject(new Error(`Query failed: ${err.message}`));
        } else {
          resolve(rows || []);
        }
      };

      if (params.length === 0) {
        this.db.all(sql, callback);
      } else {
        (this.db.all as any)(sql, ...params, callback);
      }
    });
  }

  async insertEntity(entity: InsertEntityParams): Promise<string> {
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

    const result = await this.executeQuery<{ id: string }>(sql, params);
    
    if (!result[0]?.id) {
      throw new Error('Failed to insert entity - no ID returned');
    }
    
    return result[0].id;
  }

  async getEntitiesByType(type: EntityType, limit: number = 100): Promise<Entity[]> {
    const sql = `
      SELECT * FROM entities 
      WHERE type = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    return this.executeQuery<Entity>(sql, [type, limit]);
  }

  async getAllEntities(limit: number = 100): Promise<Entity[]> {
    const sql = `
      SELECT * FROM entities 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    return this.executeQuery<Entity>(sql, [limit]);
  }

  async getEntitiesByConversation(conversationId: string): Promise<Entity[]> {
    const sql = `
      SELECT * FROM entities 
      WHERE source_conversation_id = ?
      ORDER BY created_at ASC
    `;
    return this.executeQuery<Entity>(sql, [conversationId]);
  }

  async insertConversation(conversation: InsertConversationParams): Promise<string> {
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

    const result = await this.executeQuery<{ id: string }>(sql, params);
    
    if (!result[0]?.id) {
      throw new Error('Failed to insert conversation - no ID returned');
    }
    
    return result[0].id;
  }

  async getConversations(limit: number = 50): Promise<Conversation[]> {
    const sql = `
      SELECT * FROM conversations 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    return this.executeQuery<Conversation>(sql, [limit]);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const sql = `
      SELECT * FROM conversations 
      WHERE id = ?
    `;
    const result = await this.executeQuery<Conversation>(sql, [id]);
    return result[0] || null;
  }

  async insertPersona(persona: PersonaParams): Promise<string> {
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

    const result = await this.executeQuery<{ id: string }>(sql, params);
    
    if (!result[0]?.id) {
      throw new Error('Failed to insert persona - no ID returned');
    }
    
    return result[0].id;
  }

  async getPersonas(): Promise<any[]> {
    const sql = `
      SELECT * FROM personas 
      ORDER BY created_at DESC
    `;
    return this.executeQuery(sql);
  }

  async getPersonaById(id: string): Promise<any | null> {
    const sql = `
      SELECT * FROM personas 
      WHERE id = ?
    `;
    const result = await this.executeQuery(sql, [id]);
    return result[0] || null;
  }

  async updatePersona(id: string, persona: PersonaParams): Promise<void> {
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

    await this.executeQuery(sql, params);
  }

  async deletePersona(id: string): Promise<void> {
    const sql = `DELETE FROM personas WHERE id = ?`;
    await this.executeQuery(sql, [id]);
  }
}