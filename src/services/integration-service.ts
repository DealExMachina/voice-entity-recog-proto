import type { 
  EmailAgentConfig,
  CalendarAgentConfig,
  EmailAgentResponse,
  CalendarAgentResponse,
  Email,
  CalendarEvent,
  ClientCommunication,
  ScheduledMeeting,
  ExtractedEntity,
  Entity
} from '../types/index.js';
import { EmailAgent as EmailAgentClass } from '../agents/email-agent.js';
import { CalendarAgent as CalendarAgentClass } from '../agents/calendar-agent.js';
import { MastraAgent } from '../agents/mastra-agent.js';
import { executeQuery } from '../database/duckdb.js';

export class IntegrationService {
  private emailAgent?: EmailAgentClass;
  private calendarAgent?: CalendarAgentClass;
  private mastraAgent: MastraAgent;
  private isInitialized: boolean = false;

  constructor(mastraAgent: MastraAgent) {
    this.mastraAgent = mastraAgent;
  }

  async initialize(): Promise<void> {
    console.log('🔗 Initializing Integration Service...');
    
    // Initialize agents based on configuration
    await this.initializeAgents();
    
    this.isInitialized = true;
    console.log('✅ Integration Service initialized successfully');
  }

  private async initializeAgents(): Promise<void> {
    // Check for email configuration
    const emailConfig = this.getEmailConfig();
    if (emailConfig) {
      this.emailAgent = new EmailAgentClass(emailConfig, this.mastraAgent);
      await this.emailAgent.initialize();
      console.log('📧 Email Agent initialized');
    }

    // Check for calendar configuration
    const calendarConfig = this.getCalendarConfig();
    if (calendarConfig) {
      this.calendarAgent = new CalendarAgentClass(calendarConfig, this.mastraAgent);
      await this.calendarAgent.initialize();
      console.log('📅 Calendar Agent initialized');
    }
  }

  private getEmailConfig(): EmailAgentConfig | null {
    // Read configuration from environment variables or database
    const provider = process.env.EMAIL_PROVIDER as any;
    if (!provider) return null;

    const config: EmailAgentConfig = {
      provider,
      credentials: {
        client_id: process.env.EMAIL_CLIENT_ID,
        client_secret: process.env.EMAIL_CLIENT_SECRET,
        access_token: process.env.EMAIL_ACCESS_TOKEN,
        refresh_token: process.env.EMAIL_REFRESH_TOKEN,
        username: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASSWORD,
        server: process.env.EMAIL_SERVER,
        port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
        use_ssl: process.env.EMAIL_USE_SSL === 'true'
      },
      sync_settings: {
        sync_frequency_minutes: parseInt(process.env.EMAIL_SYNC_FREQUENCY || '15'),
        sync_history_days: parseInt(process.env.EMAIL_SYNC_HISTORY_DAYS || '7'),
        sync_attachments: process.env.EMAIL_SYNC_ATTACHMENTS === 'true',
        max_attachment_size_mb: parseInt(process.env.EMAIL_MAX_ATTACHMENT_SIZE || '10'),
        folders_to_sync: process.env.EMAIL_FOLDERS_TO_SYNC?.split(',') || ['INBOX'],
        exclude_folders: process.env.EMAIL_EXCLUDE_FOLDERS?.split(',') || []
      },
      processing_rules: this.getDefaultEmailProcessingRules()
    };

    return config;
  }

  private getCalendarConfig(): CalendarAgentConfig | null {
    // Read configuration from environment variables or database
    const provider = process.env.CALENDAR_PROVIDER as any;
    if (!provider) return null;

    const config: CalendarAgentConfig = {
      provider,
      credentials: {
        client_id: process.env.CALENDAR_CLIENT_ID,
        client_secret: process.env.CALENDAR_CLIENT_SECRET,
        access_token: process.env.CALENDAR_ACCESS_TOKEN,
        refresh_token: process.env.CALENDAR_REFRESH_TOKEN,
        calendar_id: process.env.CALENDAR_ID
      },
      sync_settings: {
        sync_frequency_minutes: parseInt(process.env.CALENDAR_SYNC_FREQUENCY || '15'),
        sync_history_days: parseInt(process.env.CALENDAR_SYNC_HISTORY_DAYS || '7'),
        sync_future_days: parseInt(process.env.CALENDAR_SYNC_FUTURE_DAYS || '30'),
        calendars_to_sync: process.env.CALENDAR_CALENDARS_TO_SYNC?.split(',') || ['primary'],
        exclude_calendars: process.env.CALENDAR_EXCLUDE_CALENDARS?.split(',') || []
      },
      processing_rules: this.getDefaultCalendarProcessingRules()
    };

    return config;
  }

  private getDefaultEmailProcessingRules(): any[] {
    return [
      {
        id: 'client_communication',
        name: 'Client Communication Detection',
        conditions: [
          {
            field: 'sender',
            operator: 'contains',
            value: '@'
          }
        ],
        actions: [
          {
            type: 'extract_entities',
            parameters: {}
          },
          {
            type: 'create_communication_record',
            parameters: {}
          }
        ],
        is_active: true,
        priority: 1
      },
      {
        id: 'meeting_opportunity',
        name: 'Meeting Opportunity Detection',
        conditions: [
          {
            field: 'body',
            operator: 'contains',
            value: 'meeting'
          }
        ],
        actions: [
          {
            type: 'schedule_follow_up',
            parameters: {
              delay_hours: 24
            }
          }
        ],
        is_active: true,
        priority: 2
      }
    ];
  }

  private getDefaultCalendarProcessingRules(): any[] {
    return [
      {
        id: 'client_meeting',
        name: 'Client Meeting Detection',
        conditions: [
          {
            field: 'title',
            operator: 'contains',
            value: 'client'
          }
        ],
        actions: [
          {
            type: 'extract_entities',
            parameters: {}
          },
          {
            type: 'create_communication_record',
            parameters: {}
          }
        ],
        is_active: true,
        priority: 1
      },
      {
        id: 'sales_meeting',
        name: 'Sales Meeting Detection',
        conditions: [
          {
            field: 'title',
            operator: 'contains',
            value: 'sales'
          }
        ],
        actions: [
          {
            type: 'create_meeting',
            parameters: {}
          }
        ],
        is_active: true,
        priority: 2
      }
    ];
  }

  async startAllSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Integration Service not initialized');
    }

    console.log('🔄 Starting all sync processes...');

    if (this.emailAgent) {
      await this.emailAgent.startSync();
    }

    if (this.calendarAgent) {
      await this.calendarAgent.startSync();
    }

    console.log('✅ All sync processes started');
  }

  async stopAllSync(): Promise<void> {
    console.log('⏹️ Stopping all sync processes...');

    if (this.emailAgent) {
      await this.emailAgent.stopSync();
    }

    if (this.calendarAgent) {
      await this.calendarAgent.stopSync();
    }

    console.log('✅ All sync processes stopped');
  }

  async getClientCommunications(entityId: string): Promise<ClientCommunication[]> {
    const sql = `
      SELECT * FROM client_communications 
      WHERE entity_id = ? 
      ORDER BY occurred_at DESC
    `;
    return executeQuery<ClientCommunication>(sql, [entityId]);
  }

  async getClientTimeline(entityId: string): Promise<{
    emails: Email[];
    events: CalendarEvent[];
    communications: ClientCommunication[];
    meetings: ScheduledMeeting[];
  }> {
    const [emails, events, communications, meetings] = await Promise.all([
      this.emailAgent?.getEmailsByEntity(entityId) || Promise.resolve([]),
      this.calendarAgent?.getEventsByEntity(entityId) || Promise.resolve([]),
      this.getClientCommunications(entityId),
      this.getScheduledMeetingsByEntity(entityId)
    ]);

    return {
      emails,
      events,
      communications,
      meetings
    };
  }

  async getScheduledMeetingsByEntity(entityId: string): Promise<ScheduledMeeting[]> {
    const sql = `
      SELECT * FROM scheduled_meetings 
      WHERE JSON_CONTAINS(entity_ids, ?) 
      ORDER BY created_at DESC
    `;
    return executeQuery<ScheduledMeeting>(sql, [JSON.stringify(entityId)]);
  }

  async searchEntities(query: string): Promise<Entity[]> {
    const sql = `
      SELECT * FROM entities 
      WHERE value ILIKE ? OR context ILIKE ?
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const searchTerm = `%${query}%`;
    return executeQuery<Entity>(sql, [searchTerm, searchTerm]);
  }

  async getEntitySummary(entityId: string): Promise<{
    entity: Entity;
    communication_count: number;
    email_count: number;
    event_count: number;
    meeting_count: number;
    last_communication?: string;
    upcoming_meetings: ScheduledMeeting[];
  }> {
    const [entity, communications, emails, events, meetings] = await Promise.all([
      this.getEntityById(entityId),
      this.getClientCommunications(entityId),
      this.emailAgent?.getEmailsByEntity(entityId) || Promise.resolve([]),
      this.calendarAgent?.getEventsByEntity(entityId) || Promise.resolve([]),
      this.getScheduledMeetingsByEntity(entityId)
    ]);

    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const upcomingMeetings = meetings.filter(m => 
      m.status === 'confirmed' && 
      m.confirmed_time && 
      new Date(m.confirmed_time) > new Date()
    );

    const lastCommunication = communications.length > 0 
      ? communications[0].occurred_at 
      : undefined;

    return {
      entity,
      communication_count: communications.length,
      email_count: emails.length,
      event_count: events.length,
      meeting_count: meetings.length,
      last_communication: lastCommunication,
      upcoming_meetings: upcomingMeetings
    };
  }

  private async getEntityById(entityId: string): Promise<Entity | null> {
    const sql = 'SELECT * FROM entities WHERE id = ? OR value = ? LIMIT 1';
    const results = await executeQuery<Entity>(sql, [entityId, entityId]);
    return results[0] || null;
  }

  async scheduleMeeting(meeting: Partial<ScheduledMeeting>): Promise<string> {
    const sql = `
      INSERT INTO scheduled_meetings (
        title, description, entity_ids, proposed_times, duration_minutes,
        meeting_type, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const params = [
      meeting.title,
      meeting.description,
      JSON.stringify(meeting.entity_ids || []),
      JSON.stringify(meeting.proposed_times || []),
      meeting.duration_minutes || 60,
      meeting.meeting_type || 'sales_call',
      meeting.status || 'proposed',
      meeting.notes
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    return result[0]?.id || '';
  }

  async sendEmail(to: string[], subject: string, body: string, options?: {
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
  }): Promise<string> {
    if (!this.emailAgent) {
      throw new Error('Email agent not configured');
    }

    // This would integrate with the email agent to send emails
    console.log('📧 Sending email:', { to, subject, body });
    
    // For now, return a mock email ID
    return `email_${Date.now()}`;
  }

  async createCalendarEvent(event: Partial<CalendarEvent>): Promise<string> {
    if (!this.calendarAgent) {
      throw new Error('Calendar agent not configured');
    }

    return await this.calendarAgent.createEvent(event);
  }

  async getAgentStatus(): Promise<{
    email_agent: boolean;
    calendar_agent: boolean;
    email_sync_running: boolean;
    calendar_sync_running: boolean;
  }> {
    return {
      email_agent: !!this.emailAgent,
      calendar_agent: !!this.calendarAgent,
      email_sync_running: false, // Would need to track this in the agent
      calendar_sync_running: false // Would need to track this in the agent
    };
  }

  async getRecentActivity(limit: number = 20): Promise<{
    emails: Email[];
    events: CalendarEvent[];
    communications: ClientCommunication[];
  }> {
    const [emails, events, communications] = await Promise.all([
      this.emailAgent?.searchEmails({ limit }) || Promise.resolve([]),
      this.calendarAgent?.searchEvents({ limit }) || Promise.resolve([]),
      this.getRecentCommunications(limit)
    ]);

    return {
      emails,
      events,
      communications
    };
  }

  private async getRecentCommunications(limit: number): Promise<ClientCommunication[]> {
    const sql = `
      SELECT * FROM client_communications 
      ORDER BY occurred_at DESC 
      LIMIT ?
    `;
    return executeQuery<ClientCommunication>(sql, [limit]);
  }

  async getAnalytics(): Promise<{
    total_entities: number;
    total_emails: number;
    total_events: number;
    total_communications: number;
    total_meetings: number;
    entities_by_type: Record<string, number>;
    communications_by_type: Record<string, number>;
  }> {
    const [
      totalEntities,
      totalEmails,
      totalEvents,
      totalCommunications,
      totalMeetings,
      entitiesByType,
      communicationsByType
    ] = await Promise.all([
      this.getTotalEntities(),
      this.getTotalEmails(),
      this.getTotalEvents(),
      this.getTotalCommunications(),
      this.getTotalMeetings(),
      this.getEntitiesByType(),
      this.getCommunicationsByType()
    ]);

    return {
      total_entities: totalEntities,
      total_emails: totalEmails,
      total_events: totalEvents,
      total_communications: totalCommunications,
      total_meetings: totalMeetings,
      entities_by_type: entitiesByType,
      communications_by_type: communicationsByType
    };
  }

  private async getTotalEntities(): Promise<number> {
    const result = await executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM entities');
    return result[0]?.count || 0;
  }

  private async getTotalEmails(): Promise<number> {
    const result = await executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM emails');
    return result[0]?.count || 0;
  }

  private async getTotalEvents(): Promise<number> {
    const result = await executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM calendar_events');
    return result[0]?.count || 0;
  }

  private async getTotalCommunications(): Promise<number> {
    const result = await executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM client_communications');
    return result[0]?.count || 0;
  }

  private async getTotalMeetings(): Promise<number> {
    const result = await executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM scheduled_meetings');
    return result[0]?.count || 0;
  }

  private async getEntitiesByType(): Promise<Record<string, number>> {
    const result = await executeQuery<{ type: string; count: number }>(
      'SELECT type, COUNT(*) as count FROM entities GROUP BY type'
    );
    
    const entitiesByType: Record<string, number> = {};
    for (const row of result) {
      entitiesByType[row.type] = row.count;
    }
    
    return entitiesByType;
  }

  private async getCommunicationsByType(): Promise<Record<string, number>> {
    const result = await executeQuery<{ communication_type: string; count: number }>(
      'SELECT communication_type, COUNT(*) as count FROM client_communications GROUP BY communication_type'
    );
    
    const communicationsByType: Record<string, number> = {};
    for (const row of result) {
      communicationsByType[row.communication_type] = row.count;
    }
    
    return communicationsByType;
  }
}