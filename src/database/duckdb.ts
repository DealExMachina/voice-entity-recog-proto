import DuckDB from 'duckdb';
import fs from 'fs';
import path from 'path';
import type { 
  Entity, 
  Conversation, 
  EntityType, 
  DatabaseConfig,
  DatabaseConnection,
  Opportunity,
  OpportunityUpdate,
  SalesInteraction,
  OpportunityStage,
  OpportunityStatus
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

        -- Sales Opportunities table
        CREATE TABLE IF NOT EXISTS opportunities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title VARCHAR NOT NULL,
          description TEXT,
          client_organization VARCHAR,
          contact_person VARCHAR,
          estimated_value DECIMAL(15,2),
          currency VARCHAR(3) DEFAULT 'USD',
          probability FLOAT DEFAULT 0.5,
          stage VARCHAR DEFAULT 'discovery',
          decision_date DATE,
          status VARCHAR DEFAULT 'active',
          source_conversation_id UUID,
          context_summary TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Opportunity Updates table (for tracking conversation history)
        CREATE TABLE IF NOT EXISTS opportunity_updates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          opportunity_id UUID REFERENCES opportunities(id),
          conversation_id UUID REFERENCES conversations(id),
          update_type VARCHAR NOT NULL, -- 'new_info', 'status_change', 'value_update', etc.
          summary TEXT,
          confidence FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Sales Interactions table (for conversational agent responses)
        CREATE TABLE IF NOT EXISTS sales_interactions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          conversation_id UUID REFERENCES conversations(id),
          opportunity_id UUID REFERENCES opportunities(id),
          agent_analysis TEXT,
          agent_response TEXT,
          follow_up_questions JSON,
          confidence_score FLOAT,
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
        CREATE INDEX IF NOT EXISTS idx_entities_source_conversation ON entities(source_conversation_id);
        CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_organization);
        CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
        CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
        CREATE INDEX IF NOT EXISTS idx_opportunities_decision_date ON opportunities(decision_date);
        CREATE INDEX IF NOT EXISTS idx_opportunity_updates_opportunity ON opportunity_updates(opportunity_id);
        CREATE INDEX IF NOT EXISTS idx_sales_interactions_conversation ON sales_interactions(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_sales_interactions_opportunity ON sales_interactions(opportunity_id);
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

// Opportunity management functions
interface InsertOpportunityParams {
  title: string;
  description?: string;
  client_organization?: string;
  contact_person?: string;
  estimated_value?: number;
  currency?: string;
  probability?: number;
  stage?: OpportunityStage;
  decision_date?: string;
  source_conversation_id?: string;
  context_summary?: string;
  metadata?: Record<string, unknown>;
}

export async function insertOpportunity(opportunity: InsertOpportunityParams): Promise<string> {
  const sql = `
    INSERT INTO opportunities (
      title, description, client_organization, contact_person, 
      estimated_value, currency, probability, stage, decision_date,
      source_conversation_id, context_summary, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    opportunity.title,
    opportunity.description || null,
    opportunity.client_organization || null,
    opportunity.contact_person || null,
    opportunity.estimated_value || null,
    opportunity.currency || 'USD',
    opportunity.probability || 0.5,
    opportunity.stage || 'discovery',
    opportunity.decision_date || null,
    opportunity.source_conversation_id || null,
    opportunity.context_summary || null,
    JSON.stringify(opportunity.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert opportunity - no ID returned');
  }
  
  return result[0].id;
}

export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  const sql = `
    SELECT * FROM opportunities 
    WHERE id = ?
  `;
  const result = await executeQuery<Opportunity>(sql, [id]);
  return result[0] || null;
}

export async function getOpportunitiesByClient(clientOrganization: string): Promise<Opportunity[]> {
  const sql = `
    SELECT * FROM opportunities 
    WHERE client_organization ILIKE ?
    ORDER BY created_at DESC
  `;
  return executeQuery<Opportunity>(sql, [`%${clientOrganization}%`]);
}

export async function getActiveOpportunities(limit: number = 50): Promise<Opportunity[]> {
  const sql = `
    SELECT * FROM opportunities 
    WHERE status = 'active'
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<Opportunity>(sql, [limit]);
}

export async function updateOpportunity(id: string, updates: Partial<InsertOpportunityParams>): Promise<boolean> {
  const setClause = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const sql = `
    UPDATE opportunities 
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  const params = [...Object.values(updates), id];
  
  try {
    await executeQuery(sql, params);
    return true;
  } catch (error) {
    console.error('Failed to update opportunity:', error);
    return false;
  }
}

// Opportunity Updates functions
interface InsertOpportunityUpdateParams {
  opportunity_id: string;
  conversation_id: string;
  update_type: string;
  summary?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export async function insertOpportunityUpdate(update: InsertOpportunityUpdateParams): Promise<string> {
  const sql = `
    INSERT INTO opportunity_updates (
      opportunity_id, conversation_id, update_type, summary, confidence, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    update.opportunity_id,
    update.conversation_id,
    update.update_type,
    update.summary || null,
    update.confidence || null,
    JSON.stringify(update.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert opportunity update - no ID returned');
  }
  
  return result[0].id;
}

export async function getOpportunityUpdates(opportunityId: string): Promise<OpportunityUpdate[]> {
  const sql = `
    SELECT * FROM opportunity_updates 
    WHERE opportunity_id = ?
    ORDER BY created_at ASC
  `;
  return executeQuery<OpportunityUpdate>(sql, [opportunityId]);
}

// Sales Interactions functions
interface InsertSalesInteractionParams {
  conversation_id: string;
  opportunity_id?: string;
  agent_analysis: string;
  agent_response: string;
  follow_up_questions: string[];
  confidence_score: number;
  metadata?: Record<string, unknown>;
}

export async function insertSalesInteraction(interaction: InsertSalesInteractionParams): Promise<string> {
  const sql = `
    INSERT INTO sales_interactions (
      conversation_id, opportunity_id, agent_analysis, agent_response,
      follow_up_questions, confidence_score, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    interaction.conversation_id,
    interaction.opportunity_id || null,
    interaction.agent_analysis,
    interaction.agent_response,
    JSON.stringify(interaction.follow_up_questions),
    interaction.confidence_score,
    JSON.stringify(interaction.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  
  if (!result[0]?.id) {
    throw new Error('Failed to insert sales interaction - no ID returned');
  }
  
  return result[0].id;
}

export async function getSalesInteractionsByConversation(conversationId: string): Promise<SalesInteraction[]> {
  const sql = `
    SELECT * FROM sales_interactions 
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `;
  return executeQuery<SalesInteraction>(sql, [conversationId]);
}

export async function getSalesInteractionsByOpportunity(opportunityId: string): Promise<SalesInteraction[]> {
  const sql = `
    SELECT * FROM sales_interactions 
    WHERE opportunity_id = ?
    ORDER BY created_at ASC
  `;
  return executeQuery<SalesInteraction>(sql, [opportunityId]);
} 