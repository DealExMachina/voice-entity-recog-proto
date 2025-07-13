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
  | 'agent_response'
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

// Agent Persona Types
export interface AgentPersona {
  id: string;
  name: string;
  description: string;
  voice: VoiceConfig;
  personality: PersonalityConfig;
  expertise: string[];
  created_at?: string;
  updated_at?: string;
}

export interface VoiceConfig {
  provider: 'openai' | 'azure' | 'google' | 'demo';
  voice: string;
  language: string;
  speed: number; // 0.5 to 2.0
  pitch: number; // -20 to 20
  volume: number; // 0 to 1
}

export interface PersonalityConfig {
  tone: 'professional' | 'friendly' | 'casual' | 'formal' | 'enthusiastic';
  style: 'conversational' | 'technical' | 'educational' | 'persuasive';
  traits: string[];
  responseLength: 'short' | 'medium' | 'long';
}

// Text-to-Speech Types
export interface TTSRequest {
  text: string;
  voiceConfig?: Partial<VoiceConfig> | undefined;
  personaId?: string | undefined;
}

export interface TTSResponse {
  audioUrl: string;
  duration: number;
  wordCount: number;
  metadata?: Record<string, unknown>;
}

// Agent Response Types
export interface AgentResponse {
  text: string;
  audioUrl?: string;
  entities: ExtractedEntity[];
  confidence: number;
  responseTime: number;
  personaUsed: string;
} 

// Email Integration Types
export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  email: string;
  display_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  settings?: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type EmailProvider = 'gmail' | 'outlook' | 'imap' | 'exchange';

export interface Email {
  id: string;
  account_id: string;
  external_id?: string;
  thread_id?: string;
  subject?: string;
  sender: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  body_text?: string;
  body_html?: string;
  received_at?: string;
  sent_at?: string;
  is_read: boolean;
  is_important: boolean;
  labels?: string[];
  attachments?: EmailAttachment[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface EmailAttachment {
  filename: string;
  content_type: string;
  size: number;
  content_id?: string;
  data?: Buffer;
}

export interface EmailSearchCriteria {
  account_id?: string;
  sender?: string;
  recipients?: string[];
  subject?: string;
  body_text?: string;
  date_from?: string;
  date_to?: string;
  is_read?: boolean;
  is_important?: boolean;
  labels?: string[];
  limit?: number;
  offset?: number;
}

// Calendar Integration Types
export interface CalendarAccount {
  id: string;
  provider: CalendarProvider;
  email: string;
  display_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  calendar_id?: string;
  settings?: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CalendarProvider = 'google' | 'outlook' | 'ical' | 'exchange';

export interface CalendarEvent {
  id: string;
  account_id: string;
  external_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  attendees?: CalendarAttendee[];
  organizer?: string;
  is_all_day: boolean;
  recurrence?: RecurrenceRule;
  status: EventStatus;
  visibility: EventVisibility;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  response_status: 'accepted' | 'declined' | 'tentative' | 'needs_action';
  is_organizer?: boolean;
  is_optional?: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: string;
  by_day?: string[];
  by_month_day?: number[];
  by_month?: number[];
  by_year_day?: number[];
  by_week_no?: number[];
  by_hour?: number[];
  by_minute?: number[];
  by_second?: number[];
  by_set_pos?: number[];
  week_start?: string;
}

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type EventVisibility = 'public' | 'private' | 'default';

export interface CalendarSearchCriteria {
  account_id?: string;
  title?: string;
  description?: string;
  location?: string;
  start_time_from?: string;
  start_time_to?: string;
  attendees?: string[];
  organizer?: string;
  status?: EventStatus;
  limit?: number;
  offset?: number;
}

// Client Communication Tracking
export interface ClientCommunication {
  id: string;
  entity_id: string;
  communication_type: CommunicationType;
  external_id?: string;
  subject?: string;
  content?: string;
  participants?: CommunicationParticipant[];
  occurred_at?: string;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export type CommunicationType = 'email' | 'calendar' | 'voice' | 'meeting';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'sent' | 'received' | 'scheduled' | 'completed';

export interface CommunicationParticipant {
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
}

// Meeting Scheduling
export interface ScheduledMeeting {
  id: string;
  title: string;
  description?: string;
  entity_ids: string[];
  proposed_times: ProposedTimeSlot[];
  confirmed_time?: string;
  duration_minutes: number;
  meeting_type: MeetingType;
  status: MeetingStatus;
  calendar_event_id?: string;
  email_thread_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProposedTimeSlot {
  start_time: string;
  end_time: string;
  timezone: string;
}

export type MeetingType = 'sales_call' | 'demo' | 'follow_up' | 'discovery' | 'proposal' | 'negotiation';
export type MeetingStatus = 'proposed' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

// Email and Calendar Agent Types
export interface EmailAgentConfig {
  provider: EmailProvider;
  credentials: EmailCredentials;
  sync_settings: EmailSyncSettings;
  processing_rules: EmailProcessingRule[];
}

export interface EmailCredentials {
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  username?: string;
  password?: string;
  server?: string;
  port?: number;
  use_ssl?: boolean;
}

export interface EmailSyncSettings {
  sync_frequency_minutes: number;
  sync_history_days: number;
  sync_attachments: boolean;
  max_attachment_size_mb: number;
  folders_to_sync: string[];
  exclude_folders: string[];
}

export interface EmailProcessingRule {
  id: string;
  name: string;
  conditions: EmailCondition[];
  actions: EmailAction[];
  is_active: boolean;
  priority: number;
}

export interface EmailCondition {
  field: 'sender' | 'recipients' | 'subject' | 'body' | 'labels' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'before' | 'after';
  value: string;
}

export interface EmailAction {
  type: 'extract_entities' | 'create_communication_record' | 'schedule_follow_up' | 'send_notification' | 'add_label';
  parameters: Record<string, unknown>;
}

export interface CalendarAgentConfig {
  provider: CalendarProvider;
  credentials: CalendarCredentials;
  sync_settings: CalendarSyncSettings;
  processing_rules: CalendarProcessingRule[];
}

export interface CalendarCredentials {
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  refresh_token?: string;
  calendar_id?: string;
}

export interface CalendarSyncSettings {
  sync_frequency_minutes: number;
  sync_history_days: number;
  sync_future_days: number;
  calendars_to_sync: string[];
  exclude_calendars: string[];
}

export interface CalendarProcessingRule {
  id: string;
  name: string;
  conditions: CalendarCondition[];
  actions: CalendarAction[];
  is_active: boolean;
  priority: number;
}

export interface CalendarCondition {
  field: 'title' | 'description' | 'location' | 'attendees' | 'organizer' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'before' | 'after';
  value: string;
}

export interface CalendarAction {
  type: 'extract_entities' | 'create_communication_record' | 'schedule_follow_up' | 'send_notification' | 'create_meeting';
  parameters: Record<string, unknown>;
}

// Agent Response Types for Email/Calendar
export interface EmailAgentResponse {
  success: boolean;
  emails_processed: number;
  entities_extracted: ExtractedEntity[];
  communications_created: ClientCommunication[];
  meetings_scheduled: ScheduledMeeting[];
  errors?: string[];
}

export interface CalendarAgentResponse {
  success: boolean;
  events_processed: number;
  entities_extracted: ExtractedEntity[];
  communications_created: ClientCommunication[];
  meetings_scheduled: ScheduledMeeting[];
  errors?: string[];
} 