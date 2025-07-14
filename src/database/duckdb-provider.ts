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

        // Create basic tables needed for core functionality
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

          -- Create basic indexes
          CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
          CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
          CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
          CREATE INDEX IF NOT EXISTS idx_personas_name ON personas(name);
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