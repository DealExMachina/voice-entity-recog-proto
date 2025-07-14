import { v4 as uuidv4 } from 'uuid';
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

interface MockEntity extends Entity {
  id: string;
  created_at: string;
  updated_at: string;
}

interface MockConversation extends Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

interface MockPersona {
  id: string;
  name: string;
  description: string;
  voice: Record<string, unknown>;
  personality: Record<string, unknown>;
  expertise: string[];
  created_at: string;
  updated_at: string;
}

export class MockDatabaseProvider implements DatabaseProvider {
  private entities: Map<string, MockEntity> = new Map();
  private conversations: Map<string, MockConversation> = new Map();
  private personas: Map<string, MockPersona> = new Map();
  private initialized = false;

  async initialize(config?: DatabaseConfig): Promise<void> {
    // Reset all data for clean test state
    this.entities.clear();
    this.conversations.clear();
    this.personas.clear();
    this.initialized = true;
    console.log('🧪 Mock database initialized');
  }

  async close(): Promise<void> {
    this.initialized = false;
    console.log('🧪 Mock database closed');
  }

  async executeQuery<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    // Simple mock implementation - could be enhanced for specific test needs
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }
    
    // For testing purposes, just return empty array
    // Real tests would use the specific methods below
    return [];
  }

  async insertEntity(entity: InsertEntityParams): Promise<string> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    const mockEntity: MockEntity = {
      id,
      type: entity.type,
      value: entity.value,
      confidence: entity.confidence,
      context: entity.context,
      source_conversation_id: entity.source_conversation_id,
      metadata: {
        provider: 'demo' as const,
        extractedAt: now,
        ...entity.metadata
      },
      created_at: now,
      updated_at: now
    };

    this.entities.set(id, mockEntity);
    return id;
  }

  async getEntitiesByType(type: EntityType, limit: number = 100): Promise<Entity[]> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const filtered = Array.from(this.entities.values())
      .filter(entity => entity.type === type)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return filtered;
  }

  async getAllEntities(limit: number = 100): Promise<Entity[]> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const all = Array.from(this.entities.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return all;
  }

  async getEntitiesByConversation(conversationId: string): Promise<Entity[]> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const filtered = Array.from(this.entities.values())
      .filter(entity => entity.source_conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return filtered;
  }

  async insertConversation(conversation: InsertConversationParams): Promise<string> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    const mockConversation: MockConversation = {
      id,
      transcription: conversation.transcription,
      audio_duration: conversation.audio_duration,
      metadata: {
        provider: 'demo' as const,
        processedAt: now,
        entityCount: 0,
        ...conversation.metadata
      },
      created_at: now,
      updated_at: now
    };

    this.conversations.set(id, mockConversation);
    return id;
  }

  async getConversations(limit: number = 50): Promise<Conversation[]> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const all = Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return all;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    return this.conversations.get(id) || null;
  }

  async insertPersona(persona: PersonaParams): Promise<string> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    const mockPersona: MockPersona = {
      id,
      name: persona.name,
      description: persona.description,
      voice: persona.voice,
      personality: persona.personality,
      expertise: persona.expertise,
      created_at: now,
      updated_at: now
    };

    this.personas.set(id, mockPersona);
    return id;
  }

  async getPersonas(): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    return Array.from(this.personas.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getPersonaById(id: string): Promise<any | null> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    return this.personas.get(id) || null;
  }

  async updatePersona(id: string, persona: PersonaParams): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    const existing = this.personas.get(id);
    if (!existing) {
      throw new Error(`Persona with id ${id} not found`);
    }

    const updated: MockPersona = {
      ...existing,
      name: persona.name,
      description: persona.description,
      voice: persona.voice,
      personality: persona.personality,
      expertise: persona.expertise,
      updated_at: new Date().toISOString()
    };

    this.personas.set(id, updated);
  }

  async deletePersona(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Mock database not initialized');
    }

    if (!this.personas.has(id)) {
      throw new Error(`Persona with id ${id} not found`);
    }

    this.personas.delete(id);
  }

  // Test utilities
  reset(): void {
    this.entities.clear();
    this.conversations.clear();
    this.personas.clear();
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  getConversationCount(): number {
    return this.conversations.size;
  }

  getPersonaCount(): number {
    return this.personas.size;
  }
}