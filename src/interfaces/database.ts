import type { 
  Entity, 
  Conversation, 
  EntityType, 
  DatabaseConfig 
} from '../types/index.js';

export interface InsertEntityParams {
  type: EntityType;
  value: string;
  confidence: number;
  context: string;
  source_conversation_id: string;
  metadata: Record<string, unknown>;
}

export interface InsertConversationParams {
  transcription: string;
  audio_duration: number;
  metadata: Record<string, unknown>;
}

export interface PersonaParams {
  name: string;
  description: string;
  voice: Record<string, unknown>;
  personality: Record<string, unknown>;
  expertise: string[];
}

export interface DatabaseProvider {
  // Core operations
  initialize(config?: DatabaseConfig): Promise<void>;
  close(): Promise<void>;
  executeQuery<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  
  // Entity operations
  insertEntity(entity: InsertEntityParams): Promise<string>;
  getEntitiesByType(type: EntityType, limit?: number): Promise<Entity[]>;
  getAllEntities(limit?: number): Promise<Entity[]>;
  getEntitiesByConversation(conversationId: string): Promise<Entity[]>;
  
  // Conversation operations
  insertConversation(conversation: InsertConversationParams): Promise<string>;
  getConversations(limit?: number): Promise<Conversation[]>;
  getConversationById(id: string): Promise<Conversation | null>;
  
  // Persona operations
  insertPersona(persona: PersonaParams): Promise<string>;
  getPersonas(): Promise<any[]>;
  getPersonaById(id: string): Promise<any | null>;
  updatePersona(id: string, persona: PersonaParams): Promise<void>;
  deletePersona(id: string): Promise<void>;
}