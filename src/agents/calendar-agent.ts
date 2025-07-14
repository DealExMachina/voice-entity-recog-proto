import { google } from 'googleapis';
import type { 
  CalendarAccount, 
  CalendarEvent, 
  CalendarSearchCriteria, 
  CalendarAgentConfig,
  CalendarAgentResponse,
  ExtractedEntity,
  ClientCommunication,
  ScheduledMeeting,
  CalendarAttendee,
  RecurrenceRule
} from '../types/index.js';
import { executeQuery } from '../database/duckdb.js';
import { MastraAgent } from './mastra-agent.js';

export class CalendarAgent {
  private config: CalendarAgentConfig;
  private mastraAgent: MastraAgent;
  private syncInterval: NodeJS.Timeout | undefined = undefined;
  private isRunning: boolean = false;

  constructor(config: CalendarAgentConfig, mastraAgent: MastraAgent) {
    this.config = config;
    this.mastraAgent = mastraAgent;
  }

  async initialize(): Promise<void> {
    console.log('📅 Initializing Calendar Agent...');
    
    // Validate configuration
    this.validateConfig();
    
    // Test connection
    await this.testConnection();
    
    console.log('✅ Calendar Agent initialized successfully');
  }

  private validateConfig(): void {
    if (!this.config.provider) {
      throw new Error('Calendar provider is required');
    }
    
    if (!this.config.credentials) {
      throw new Error('Calendar credentials are required');
    }
    
    // Provider-specific validation
    switch (this.config.provider) {
      case 'google':
        if (!this.config.credentials.client_id || !this.config.credentials.client_secret) {
          throw new Error('Google Calendar requires client_id and client_secret');
        }
        break;
      default:
        throw new Error(`Unsupported calendar provider: ${this.config.provider}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'google':
          await this.testGoogleCalendarConnection();
          break;
        default:
          throw new Error(`Connection test not implemented for provider: ${this.config.provider}`);
      }
    } catch (error) {
      throw new Error(`Calendar connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testGoogleCalendarConnection(): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.credentials.client_id,
      this.config.credentials.client_secret
    );

    if (this.config.credentials.access_token) {
      oauth2Client.setCredentials({
        access_token: this.config.credentials.access_token,
        refresh_token: this.config.credentials.refresh_token || null
      });
    } else {
      throw new Error('Google Calendar access token is required for testing connection');
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list();
  }

  async startSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Calendar sync is already running');
      return;
    }

    console.log('🔄 Starting calendar sync...');
    this.isRunning = true;

    // Initial sync
    await this.syncEvents();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.syncEvents();
      }
    }, this.config.sync_settings.sync_frequency_minutes * 60 * 1000);
  }

  async stopSync(): Promise<void> {
    console.log('⏹️ Stopping calendar sync...');
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private async syncEvents(): Promise<void> {
    try {
      console.log('📅 Syncing calendar events...');
      
      let events: CalendarEvent[] = [];
      
      switch (this.config.provider) {
        case 'google':
          events = await this.syncGoogleCalendarEvents();
          break;
        default:
          throw new Error(`Sync not implemented for provider: ${this.config.provider}`);
      }

      console.log(`📅 Synced ${events.length} calendar events`);

      // Process events for entity extraction and client tracking
      await this.processEvents(events);

    } catch (error) {
      console.error('❌ Calendar sync error:', error);
    }
  }

  private async syncGoogleCalendarEvents(): Promise<CalendarEvent[]> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.credentials.client_id,
      this.config.credentials.client_secret
    );

    oauth2Client.setCredentials({
      access_token: this.config.credentials.access_token || null,
      refresh_token: this.config.credentials.refresh_token || null
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Calculate date range for sync
    const now = new Date();
    const timeMin = new Date(now.getTime() - this.config.sync_settings.sync_history_days * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + this.config.sync_settings.sync_future_days * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: this.config.credentials.calendar_id || 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events: CalendarEvent[] = [];
    
    if (response.data.items) {
      for (const event of response.data.items) {
        try {
          const calendarEvent = this.convertGoogleEventToCalendarEvent(event);
          if (calendarEvent) {
            events.push(calendarEvent);
          }
        } catch (error) {
          console.error(`Error converting event ${event.id}:`, error);
        }
      }
    }

    return events;
  }

  private convertGoogleEventToCalendarEvent(googleEvent: any): CalendarEvent | null {
    if (!googleEvent.id) return null;

    const start = googleEvent.start?.dateTime || googleEvent.start?.date;
    const end = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!start || !end) return null;

    const attendees: CalendarAttendee[] = (googleEvent.attendees || []).map((attendee: any) => ({
      email: attendee.email,
      name: attendee.displayName,
      response_status: attendee.responseStatus || 'needs_action',
      is_organizer: attendee.organizer || false,
      is_optional: attendee.optional || false
    }));

    const recurrence: RecurrenceRule | undefined = googleEvent.recurrence 
      ? this.parseRecurrenceRule(googleEvent.recurrence[0])
      : undefined;

    const event: CalendarEvent = {
      id: googleEvent.id,
      account_id: 'google', // This should be the actual account ID from database
      external_id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      location: googleEvent.location,
      start_time: start,
      end_time: end,
      timezone: googleEvent.start?.timeZone,
      attendees,
      organizer: googleEvent.organizer?.email,
      is_all_day: !!googleEvent.start?.date, // If start has date but no dateTime, it's all-day
      recurrence,
      status: googleEvent.status || 'confirmed',
      visibility: googleEvent.visibility || 'default',
      metadata: {
        google_event_id: googleEvent.id,
        html_link: googleEvent.htmlLink,
        created: googleEvent.created,
        updated: googleEvent.updated
      }
    };

    return event;
  }

  private parseRecurrenceRule(recurrenceString: string): RecurrenceRule | undefined {
    // Parse RRULE format (e.g., "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR")
    const rule: RecurrenceRule = {
      frequency: 'daily'
    };

    const parts = recurrenceString.split(';');
    for (const part of parts) {
      const [key, value] = part.split('=');
      
      switch (key) {
        case 'FREQ':
          rule.frequency = value.toLowerCase() as any;
          break;
        case 'INTERVAL':
          rule.interval = parseInt(value);
          break;
        case 'COUNT':
          rule.count = parseInt(value);
          break;
        case 'UNTIL':
          rule.until = value;
          break;
        case 'BYDAY':
          rule.by_day = value.split(',');
          break;
        case 'BYMONTHDAY':
          rule.by_month_day = value.split(',').map(v => parseInt(v));
          break;
        case 'BYMONTH':
          rule.by_month = value.split(',').map(v => parseInt(v));
          break;
        case 'WKST':
          rule.week_start = value;
          break;
      }
    }

    return rule;
  }

  private async processEvents(events: CalendarEvent[]): Promise<CalendarAgentResponse> {
    const response: CalendarAgentResponse = {
      success: true,
      events_processed: events.length,
      entities_extracted: [],
      communications_created: [],
      meetings_scheduled: [],
      errors: []
    };

    for (const event of events) {
      try {
        // Check if event already processed
        const existingEvent = await this.getEventByExternalId(event.external_id);
        if (existingEvent) {
          continue;
        }

        // Store event in database
        const eventId = await this.storeEvent(event);

        // Extract entities from event content
        const content = [
          event.title,
          event.description,
          event.location,
          event.attendees?.map(a => a.name || a.email).join(', ')
        ].filter(Boolean).join(' ');

        const entities = await this.mastraAgent.extractEntities(content);

        // Store extracted entities
        for (const entity of entities) {
          await this.storeEntity(entity, eventId);
        }

        response.entities_extracted.push(...entities);

        // Create communication record
        const communication = await this.createCommunicationRecord(event, entities);
        if (communication) {
          response.communications_created.push(communication);
        }

        // Apply processing rules
        await this.applyProcessingRules(event, entities);

        // Check for meeting scheduling opportunities
        const meetings = await this.identifyMeetingOpportunities(event, entities);
        response.meetings_scheduled.push(...meetings);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        response.errors?.push(`Error processing event ${event.external_id}: ${errorMsg}`);
        console.error('Error processing event:', error);
      }
    }

    return response;
  }

  private async getEventByExternalId(externalId?: string): Promise<CalendarEvent | null> {
    if (!externalId) return null;

    const sql = 'SELECT * FROM calendar_events WHERE external_id = ? LIMIT 1';
    const results = await executeQuery<CalendarEvent>(sql, [externalId]);
    return results[0] || null;
  }

  private async storeEvent(event: CalendarEvent): Promise<string> {
    const sql = `
      INSERT INTO calendar_events (
        account_id, external_id, title, description, location, start_time, 
        end_time, timezone, attendees, organizer, is_all_day, recurrence, 
        status, visibility, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const params = [
      event.account_id,
      event.external_id,
      event.title,
      event.description,
      event.location,
      event.start_time,
      event.end_time,
      event.timezone,
      event.attendees ? JSON.stringify(event.attendees) : null,
      event.organizer,
      event.is_all_day,
      event.recurrence ? JSON.stringify(event.recurrence) : null,
      event.status,
      event.visibility,
      event.metadata ? JSON.stringify(event.metadata) : null
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    return result[0]?.id || '';
  }

  private async storeEntity(entity: ExtractedEntity, eventId: string): Promise<string> {
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
      eventId, // Using event ID as source conversation ID
      JSON.stringify({
        source: 'calendar',
        event_id: eventId,
        extractedAt: new Date().toISOString()
      })
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    return result[0]?.id || '';
  }

  private async createCommunicationRecord(
    event: CalendarEvent, 
    entities: ExtractedEntity[]
  ): Promise<ClientCommunication | null> {
    // Find relevant entities (people, organizations)
    const relevantEntities = entities.filter(e => 
      e.type === 'person' || e.type === 'organization'
    );

    if (relevantEntities.length === 0) {
      return null;
    }

    // Use the first relevant entity for now (could be enhanced to handle multiple)
    const entity = relevantEntities[0];

    const sql = `
      INSERT INTO client_communications (
        entity_id, communication_type, external_id, subject, content,
        participants, occurred_at, direction, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const participants = [
      ...(event.attendees || []).map(attendee => ({
        email: attendee.email,
        name: attendee.name,
        role: attendee.is_organizer ? 'organizer' : 'attendee'
      }))
    ];

    const params = [
      entity.value, // Using entity value as entity_id for now
      'calendar',
      event.external_id,
      event.title,
      event.description,
      JSON.stringify(participants),
      event.start_time,
      'inbound',
      'scheduled',
      JSON.stringify({
        event_id: event.id,
        entities_found: entities.length,
        processing_timestamp: new Date().toISOString()
      })
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    
    if (result[0]?.id) {
      return {
        id: result[0].id,
        entity_id: entity.value,
        communication_type: 'calendar',
        external_id: event.external_id,
        subject: event.title,
        content: event.description,
        participants,
        occurred_at: event.start_time,
        direction: 'inbound',
        status: 'scheduled',
        created_at: new Date().toISOString()
      };
    }

    return null;
  }

  private async applyProcessingRules(event: CalendarEvent, entities: ExtractedEntity[]): Promise<void> {
    for (const rule of this.config.processing_rules) {
      if (!rule.is_active) continue;

      // Check if rule conditions are met
      const conditionsMet = rule.conditions.every(condition => {
        return this.evaluateCondition(event, condition);
      });

      if (conditionsMet) {
        // Execute rule actions
        for (const action of rule.actions) {
          await this.executeAction(action, event, entities);
        }
      }
    }
  }

  private evaluateCondition(event: CalendarEvent, condition: any): boolean {
    const field = condition.field;
    const operator = condition.operator;
    const value = condition.value;

    let fieldValue: string = '';

    switch (field) {
      case 'title':
        fieldValue = event.title;
        break;
      case 'description':
        fieldValue = event.description || '';
        break;
      case 'location':
        fieldValue = event.location || '';
        break;
      case 'attendees':
        fieldValue = (event.attendees || []).map(a => a.name || a.email).join(', ');
        break;
      case 'organizer':
        fieldValue = event.organizer || '';
        break;
      case 'date':
        fieldValue = event.start_time;
        break;
      default:
        return false;
    }

    switch (operator) {
      case 'contains':
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      case 'equals':
        return fieldValue.toLowerCase() === value.toLowerCase();
      case 'starts_with':
        return fieldValue.toLowerCase().startsWith(value.toLowerCase());
      case 'ends_with':
        return fieldValue.toLowerCase().endsWith(value.toLowerCase());
      case 'regex':
        try {
          const regex = new RegExp(value, 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private async executeAction(action: any, event: CalendarEvent, entities: ExtractedEntity[]): Promise<void> {
    switch (action.type) {
      case 'extract_entities':
        // Already done in processEvents
        break;
      case 'create_communication_record':
        // Already done in processEvents
        break;
      case 'schedule_follow_up':
        await this.scheduleFollowUp(event, entities, action.parameters);
        break;
      case 'send_notification':
        await this.sendNotification(event, entities, action.parameters);
        break;
      case 'create_meeting':
        await this.createMeeting(event, entities, action.parameters);
        break;
    }
  }

  private async scheduleFollowUp(
    event: CalendarEvent, 
    entities: ExtractedEntity[], 
    parameters: any
  ): Promise<void> {
    // Implementation for scheduling follow-up tasks
    console.log('📅 Scheduling follow-up for event:', event.title);
  }

  private async sendNotification(
    event: CalendarEvent, 
    entities: ExtractedEntity[], 
    parameters: any
  ): Promise<void> {
    // Implementation for sending notifications
    console.log('🔔 Sending notification for event:', event.title);
  }

  private async createMeeting(
    event: CalendarEvent, 
    entities: ExtractedEntity[], 
    parameters: any
  ): Promise<void> {
    // Implementation for creating meetings
    console.log('📋 Creating meeting from event:', event.title);
  }

  private async identifyMeetingOpportunities(
    event: CalendarEvent, 
    entities: ExtractedEntity[]
  ): Promise<ScheduledMeeting[]> {
    const meetings: ScheduledMeeting[] = [];

    // Look for meeting-related keywords in event content
    const content = [
      event.title,
      event.description,
      event.location
    ].filter(Boolean).join(' ').toLowerCase();

    const meetingKeywords = [
      'meeting', 'call', 'discussion', 'demo', 'presentation', 
      'sales', 'client', 'prospect', 'discovery', 'proposal'
    ];

    const hasMeetingKeywords = meetingKeywords.some(keyword => 
      content.includes(keyword)
    );

    if (hasMeetingKeywords) {
      // Extract person and organization entities
      const personEntities = entities.filter(e => e.type === 'person');
      const orgEntities = entities.filter(e => e.type === 'organization');

      if (personEntities.length > 0 || orgEntities.length > 0) {
        const meeting: ScheduledMeeting = {
          id: `meeting_${Date.now()}`,
          title: event.title,
          description: event.description,
          entity_ids: [...personEntities, ...orgEntities].map(e => e.value),
          proposed_times: [{
            start_time: event.start_time,
            end_time: event.end_time,
            timezone: event.timezone || 'UTC'
          }],
          duration_minutes: this.calculateDurationMinutes(event.start_time, event.end_time),
          meeting_type: this.determineMeetingType(content),
          status: 'confirmed',
          created_at: new Date().toISOString()
        };

        meetings.push(meeting);
      }
    }

    return meetings;
  }

  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  private determineMeetingType(content: string): any {
    if (content.includes('demo')) return 'demo';
    if (content.includes('sales')) return 'sales_call';
    if (content.includes('discovery')) return 'discovery';
    if (content.includes('proposal')) return 'proposal';
    if (content.includes('follow')) return 'follow_up';
    return 'sales_call';
  }

  async searchEvents(criteria: CalendarSearchCriteria): Promise<CalendarEvent[]> {
    let sql = 'SELECT * FROM calendar_events WHERE 1=1';
    const params: any[] = [];

    if (criteria.account_id) {
      sql += ' AND account_id = ?';
      params.push(criteria.account_id);
    }

    if (criteria.title) {
      sql += ' AND title LIKE ?';
      params.push(`%${criteria.title}%`);
    }

    if (criteria.description) {
      sql += ' AND description LIKE ?';
      params.push(`%${criteria.description}%`);
    }

    if (criteria.location) {
      sql += ' AND location LIKE ?';
      params.push(`%${criteria.location}%`);
    }

    if (criteria.start_time_from) {
      sql += ' AND start_time >= ?';
      params.push(criteria.start_time_from);
    }

    if (criteria.start_time_to) {
      sql += ' AND start_time <= ?';
      params.push(criteria.start_time_to);
    }

    if (criteria.organizer) {
      sql += ' AND organizer LIKE ?';
      params.push(`%${criteria.organizer}%`);
    }

    if (criteria.status) {
      sql += ' AND status = ?';
      params.push(criteria.status);
    }

    sql += ' ORDER BY start_time DESC';

    if (criteria.limit) {
      sql += ' LIMIT ?';
      params.push(criteria.limit);
    }

    if (criteria.offset) {
      sql += ' OFFSET ?';
      params.push(criteria.offset);
    }

    return executeQuery<CalendarEvent>(sql, params);
  }

  async getEventById(id: string): Promise<CalendarEvent | null> {
    const sql = 'SELECT * FROM calendar_events WHERE id = ? LIMIT 1';
    const results = await executeQuery<CalendarEvent>(sql, [id]);
    return results[0] || null;
  }

  async getEventsByEntity(entityId: string): Promise<CalendarEvent[]> {
    const sql = `
      SELECT ce.* FROM calendar_events ce
      JOIN client_communications cc ON ce.external_id = cc.external_id
      WHERE cc.entity_id = ?
      ORDER BY ce.start_time DESC
    `;
    return executeQuery<CalendarEvent>(sql, [entityId]);
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<string> {
    // Implementation for creating calendar events
    console.log('📅 Creating calendar event:', event.title);
    return 'event_id';
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    // Implementation for updating calendar events
    console.log('📅 Updating calendar event:', eventId);
  }

  async deleteEvent(eventId: string): Promise<void> {
    // Implementation for deleting calendar events
    console.log('📅 Deleting calendar event:', eventId);
  }
}