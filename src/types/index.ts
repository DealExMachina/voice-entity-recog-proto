// Core Entity Types
export interface Entity {
  id: string;
  type: EntityType;
  value: string;
  confidence: number;
  context: string;
  source_conversation_id: string;
  metadata: EntityMetadata;
  created_at?: string;
  updated_at?: string;
}

export type EntityType = 'financial' | 'date' | 'organization' | 'person' | 'location' | 'product' | 'contact';

export interface EntityMetadata {
  provider: AIProvider;
  extractedAt: string;
  [key: string]: unknown;
}

// Conversation Types
export interface Conversation {
  id: string;
  transcription: string;
  audio_duration: number;
  metadata: ConversationMetadata;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationMetadata {
  provider: AIProvider;
  processedAt: string;
  entityCount: number;
  audioFormat?: string;
  audioSize?: number;
  [key: string]: unknown;
}

// AI Provider Types
export type AIProvider = 'openai' | 'mistral' | 'demo';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// API Request/Response Types
export interface TranscriptionRequest {
  audio: Buffer;
  format?: string;
  language?: string;
}

export interface TranscriptionResponse {
  transcription: string;
  confidence?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface EntityExtractionRequest {
  text: string;
  context?: string;
  types?: EntityType[];
}

export interface EntityExtractionResponse {
  entities: ExtractedEntity[];
  metadata?: Record<string, unknown>;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  context: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: unknown;
  error?: string;
}

export type WebSocketMessageType = 
  | 'voice_data' 
  | 'entities_extracted' 
  | 'transcription_complete'
  | 'start_streaming'
  | 'streaming_started'
  | 'transcription_chunk'
  | 'end_streaming'
  | 'streaming_error'
  | 'error'
  | 'ping'
  | 'pong';

export interface VoiceDataMessage {
  type: 'voice_data';
  audio: string; // base64 encoded
  format?: string;
  sessionId?: string;
  chunkIndex?: number;
  isFinal?: boolean;
}

export interface EntitiesExtractedMessage {
  type: 'entities_extracted';
  transcription: string;
  entities: ExtractedEntity[];
  conversationId: string;
}

export interface StreamingStartedMessage {
  type: 'streaming_started';
  sessionId: string;
}

export interface TranscriptionChunkMessage {
  type: 'transcription_chunk';
  transcription: string;
  isFinal: boolean;
}

export interface StreamingErrorMessage {
  type: 'streaming_error';
  error: string;
}

export interface StartStreamingMessage {
  type: 'start_streaming';
  provider: string;
  audioFormat: string;
}

export interface EndStreamingMessage {
  type: 'end_streaming';
  sessionId: string;
}

// Database Types
export interface DatabaseConfig {
  path: string;
  readOnly?: boolean;
  memory?: boolean;
}

export interface DatabaseConnection {
  query: <T = unknown>(sql: string, params?: Record<string, unknown>) => Promise<T[]>;
  close: () => Promise<void>;
}

// MCP Types
export interface McpRequest {
  method: string;
  params: Record<string, unknown>;
  id?: string;
}

export interface McpResponse {
  result?: unknown;
  error?: McpError;
  id?: string;
}

export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

// HTTP API Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: ServiceStatus[];
  version: string;
}

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  lastCheck: string;
  details?: Record<string, unknown>;
}

// File Upload Types
export interface AudioFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
  fieldname: string;
}

// Error Types
export interface AppError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

// Configuration Types
export interface AppConfig {
  port: number;
  dbPath: string;
  aiConfig: AIConfig;
  corsOrigin: string;
  rateLimit: RateLimitConfig;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
} 