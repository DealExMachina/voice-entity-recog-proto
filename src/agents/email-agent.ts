import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import type { 
  EmailAccount, 
  Email, 
  EmailSearchCriteria, 
  EmailAgentConfig,
  EmailAgentResponse,
  ExtractedEntity,
  ClientCommunication,
  ScheduledMeeting,
  Entity
} from '../types/index.js';
import { executeQuery } from '../database/duckdb.js';
import { MastraAgent } from './mastra-agent.js';

export class EmailAgent {
  private config: EmailAgentConfig;
  private mastraAgent: MastraAgent;
  private syncInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: EmailAgentConfig, mastraAgent: MastraAgent) {
    this.config = config;
    this.mastraAgent = mastraAgent;
  }

  async initialize(): Promise<void> {
    console.log('📧 Initializing Email Agent...');
    
    // Validate configuration
    this.validateConfig();
    
    // Test connection
    await this.testConnection();
    
    console.log('✅ Email Agent initialized successfully');
  }

  private validateConfig(): void {
    if (!this.config.provider) {
      throw new Error('Email provider is required');
    }
    
    if (!this.config.credentials) {
      throw new Error('Email credentials are required');
    }
    
    // Provider-specific validation
    switch (this.config.provider) {
      case 'gmail':
        if (!this.config.credentials.client_id || !this.config.credentials.client_secret) {
          throw new Error('Gmail requires client_id and client_secret');
        }
        break;
      case 'imap':
        if (!this.config.credentials.username || !this.config.credentials.password) {
          throw new Error('IMAP requires username and password');
        }
        break;
      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'gmail':
          await this.testGmailConnection();
          break;
        case 'imap':
          await this.testImapConnection();
          break;
        default:
          throw new Error(`Connection test not implemented for provider: ${this.config.provider}`);
      }
    } catch (error) {
      throw new Error(`Email connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testGmailConnection(): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.credentials.client_id,
      this.config.credentials.client_secret
    );

    if (this.config.credentials.access_token) {
      oauth2Client.setCredentials({
        access_token: this.config.credentials.access_token,
        refresh_token: this.config.credentials.refresh_token
      });
    } else {
      throw new Error('Gmail access token is required for testing connection');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    await gmail.users.getProfile({ userId: 'me' });
  }

  private async testImapConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: this.config.credentials.username!,
        password: this.config.credentials.password!,
        host: this.config.credentials.server || 'imap.gmail.com',
        port: this.config.credentials.port || 993,
        tls: this.config.credentials.use_ssl !== false,
        tlsOptions: { rejectUnauthorized: false }
      });

      imap.once('ready', () => {
        imap.end();
        resolve();
      });

      imap.once('error', (err: Error) => {
        reject(err);
      });

      imap.connect();
    });
  }

  async startSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Email sync is already running');
      return;
    }

    console.log('🔄 Starting email sync...');
    this.isRunning = true;

    // Initial sync
    await this.syncEmails();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.syncEmails();
      }
    }, this.config.sync_settings.sync_frequency_minutes * 60 * 1000);
  }

  async stopSync(): Promise<void> {
    console.log('⏹️ Stopping email sync...');
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private async syncEmails(): Promise<void> {
    try {
      console.log('📥 Syncing emails...');
      
      let emails: Email[] = [];
      
      switch (this.config.provider) {
        case 'gmail':
          emails = await this.syncGmailEmails();
          break;
        case 'imap':
          emails = await this.syncImapEmails();
          break;
        default:
          throw new Error(`Sync not implemented for provider: ${this.config.provider}`);
      }

      console.log(`📧 Synced ${emails.length} emails`);

      // Process emails for entity extraction and client tracking
      await this.processEmails(emails);

    } catch (error) {
      console.error('❌ Email sync error:', error);
    }
  }

  private async syncGmailEmails(): Promise<Email[]> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.credentials.client_id,
      this.config.credentials.client_secret
    );

    oauth2Client.setCredentials({
      access_token: this.config.credentials.access_token,
      refresh_token: this.config.credentials.refresh_token
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Calculate date range for sync
    const syncDate = new Date();
    syncDate.setDate(syncDate.getDate() - this.config.sync_settings.sync_history_days);
    const afterDate = syncDate.toISOString();

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${afterDate}`,
      maxResults: 100
    });

    const emails: Email[] = [];
    
    if (response.data.messages) {
      for (const message of response.data.messages) {
        try {
          const email = await this.fetchGmailMessage(gmail, message.id!);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          console.error(`Error fetching message ${message.id}:`, error);
        }
      }
    }

    return emails;
  }

  private async fetchGmailMessage(gmail: any, messageId: string): Promise<Email | null> {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    const getHeader = (name: string): string => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const email: Email = {
      id: messageId,
      account_id: 'gmail', // This should be the actual account ID from database
      external_id: messageId,
      thread_id: message.threadId,
      subject: getHeader('subject'),
      sender: getHeader('from'),
      recipients: getHeader('to').split(',').map((email: string) => email.trim()),
      cc: getHeader('cc') ? getHeader('cc').split(',').map((email: string) => email.trim()) : undefined,
      body_text: this.extractGmailBody(message.payload, 'text/plain'),
      body_html: this.extractGmailBody(message.payload, 'text/html'),
      received_at: new Date(parseInt(message.internalDate)).toISOString(),
      is_read: !message.labelIds?.includes('UNREAD'),
      is_important: message.labelIds?.includes('IMPORTANT') || false,
      labels: message.labelIds || [],
      metadata: {
        gmail_message_id: messageId,
        snippet: message.snippet
      }
    };

    return email;
  }

  private extractGmailBody(payload: any, mimeType: string): string {
    if (payload.mimeType === mimeType) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const body = this.extractGmailBody(part, mimeType);
        if (body) return body;
      }
    }

    return '';
  }

  private async syncImapEmails(): Promise<Email[]> {
    return new Promise((resolve, reject) => {
      const emails: Email[] = [];
      
      const imap = new Imap({
        user: this.config.credentials.username!,
        password: this.config.credentials.password!,
        host: this.config.credentials.server || 'imap.gmail.com',
        port: this.config.credentials.port || 993,
        tls: this.config.credentials.use_ssl !== false,
        tlsOptions: { rejectUnauthorized: false }
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            reject(err);
            return;
          }

          // Search for recent emails
          const syncDate = new Date();
          syncDate.setDate(syncDate.getDate() - this.config.sync_settings.sync_history_days);
          
          imap.search(['SINCE', syncDate], (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            if (results.length === 0) {
              imap.end();
              resolve(emails);
              return;
            }

            const fetch = imap.fetch(results, { bodies: '', struct: true });

            fetch.on('message', (msg, seqno) => {
              let email: Partial<Email> = {
                account_id: 'imap', // This should be the actual account ID from database
                is_read: false,
                is_important: false
              };

              msg.on('body', (stream, info) => {
                simpleParser(stream, (err: Error | null, parsed: any) => {
                  if (err) {
                    console.error('Error parsing email:', err);
                    return;
                  }

                  email = {
                    ...email,
                    external_id: parsed.messageId,
                    subject: parsed.subject,
                    sender: parsed.from?.text || '',
                    recipients: parsed.to?.map(to => to.text) || [],
                    cc: parsed.cc?.map(cc => cc.text),
                    body_text: parsed.text,
                    body_html: parsed.html,
                    received_at: parsed.date?.toISOString(),
                    attachments: parsed.attachments?.map(att => ({
                      filename: att.filename || 'unknown',
                      content_type: att.contentType,
                      size: att.size,
                      data: att.content
                    }))
                  };
                });
              });

              msg.once('end', () => {
                if (email.external_id) {
                  emails.push(email as Email);
                }
              });
            });

            fetch.once('error', (err) => {
              reject(err);
            });

            fetch.once('end', () => {
              imap.end();
              resolve(emails);
            });
          });
        });
      });

      imap.once('error', (err) => {
        reject(err);
      });

      imap.connect();
    });
  }

  private async processEmails(emails: Email[]): Promise<EmailAgentResponse> {
    const response: EmailAgentResponse = {
      success: true,
      emails_processed: emails.length,
      entities_extracted: [],
      communications_created: [],
      meetings_scheduled: [],
      errors: []
    };

    for (const email of emails) {
      try {
        // Check if email already processed
        const existingEmail = await this.getEmailByExternalId(email.external_id);
        if (existingEmail) {
          continue;
        }

        // Store email in database
        const emailId = await this.storeEmail(email);

        // Extract entities from email content
        const content = email.body_text || email.body_html || '';
        const entities = await this.mastraAgent.extractEntities(content);

        // Store extracted entities
        for (const entity of entities) {
          await this.storeEntity(entity, emailId);
        }

        response.entities_extracted.push(...entities);

        // Create communication record
        const communication = await this.createCommunicationRecord(email, entities);
        if (communication) {
          response.communications_created.push(communication);
        }

        // Apply processing rules
        await this.applyProcessingRules(email, entities);

        // Check for meeting scheduling opportunities
        const meetings = await this.identifyMeetingOpportunities(email, entities);
        response.meetings_scheduled.push(...meetings);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        response.errors?.push(`Error processing email ${email.external_id}: ${errorMsg}`);
        console.error('Error processing email:', error);
      }
    }

    return response;
  }

  private async getEmailByExternalId(externalId?: string): Promise<Email | null> {
    if (!externalId) return null;

    const sql = 'SELECT * FROM emails WHERE external_id = ? LIMIT 1';
    const results = await executeQuery<Email>(sql, [externalId]);
    return results[0] || null;
  }

  private async storeEmail(email: Email): Promise<string> {
    const sql = `
      INSERT INTO emails (
        account_id, external_id, thread_id, subject, sender, recipients, 
        cc, bcc, body_text, body_html, received_at, sent_at, is_read, 
        is_important, labels, attachments, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const params = [
      email.account_id,
      email.external_id,
      email.thread_id,
      email.subject,
      email.sender,
      JSON.stringify(email.recipients),
      email.cc ? JSON.stringify(email.cc) : null,
      email.bcc ? JSON.stringify(email.bcc) : null,
      email.body_text,
      email.body_html,
      email.received_at,
      email.sent_at,
      email.is_read,
      email.is_important,
      email.labels ? JSON.stringify(email.labels) : null,
      email.attachments ? JSON.stringify(email.attachments) : null,
      email.metadata ? JSON.stringify(email.metadata) : null
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    return result[0]?.id || '';
  }

  private async storeEntity(entity: ExtractedEntity, emailId: string): Promise<string> {
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
      emailId, // Using email ID as source conversation ID
      JSON.stringify({
        source: 'email',
        email_id: emailId,
        extractedAt: new Date().toISOString()
      })
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    return result[0]?.id || '';
  }

  private async createCommunicationRecord(
    email: Email, 
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
      { email: email.sender, role: 'sender' },
      ...email.recipients.map(recipient => ({ email: recipient, role: 'recipient' }))
    ];

    const params = [
      entity.value, // Using entity value as entity_id for now
      'email',
      email.external_id,
      email.subject,
      email.body_text,
      JSON.stringify(participants),
      email.received_at,
      'inbound',
      'received',
      JSON.stringify({
        email_id: email.id,
        entities_found: entities.length,
        processing_timestamp: new Date().toISOString()
      })
    ];

    const result = await executeQuery<{ id: string }>(sql, params);
    
    if (result[0]?.id) {
      return {
        id: result[0].id,
        entity_id: entity.value,
        communication_type: 'email',
        external_id: email.external_id,
        subject: email.subject,
        content: email.body_text,
        participants,
        occurred_at: email.received_at,
        direction: 'inbound',
        status: 'received',
        created_at: new Date().toISOString()
      };
    }

    return null;
  }

  private async applyProcessingRules(email: Email, entities: ExtractedEntity[]): Promise<void> {
    for (const rule of this.config.processing_rules) {
      if (!rule.is_active) continue;

      // Check if rule conditions are met
      const conditionsMet = rule.conditions.every(condition => {
        return this.evaluateCondition(email, condition);
      });

      if (conditionsMet) {
        // Execute rule actions
        for (const action of rule.actions) {
          await this.executeAction(action, email, entities);
        }
      }
    }
  }

  private evaluateCondition(email: Email, condition: any): boolean {
    const field = condition.field;
    const operator = condition.operator;
    const value = condition.value;

    let fieldValue: string = '';

    switch (field) {
      case 'sender':
        fieldValue = email.sender;
        break;
      case 'recipients':
        fieldValue = email.recipients.join(', ');
        break;
      case 'subject':
        fieldValue = email.subject || '';
        break;
      case 'body':
        fieldValue = (email.body_text || email.body_html || '');
        break;
      case 'labels':
        fieldValue = (email.labels || []).join(', ');
        break;
      case 'date':
        fieldValue = email.received_at || '';
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

  private async executeAction(action: any, email: Email, entities: ExtractedEntity[]): Promise<void> {
    switch (action.type) {
      case 'extract_entities':
        // Already done in processEmails
        break;
      case 'create_communication_record':
        // Already done in processEmails
        break;
      case 'schedule_follow_up':
        await this.scheduleFollowUp(email, entities, action.parameters);
        break;
      case 'send_notification':
        await this.sendNotification(email, entities, action.parameters);
        break;
      case 'add_label':
        await this.addLabel(email, action.parameters);
        break;
    }
  }

  private async scheduleFollowUp(
    email: Email, 
    entities: ExtractedEntity[], 
    parameters: any
  ): Promise<void> {
    // Implementation for scheduling follow-up tasks
    console.log('📅 Scheduling follow-up for email:', email.subject);
  }

  private async sendNotification(
    email: Email, 
    entities: ExtractedEntity[], 
    parameters: any
  ): Promise<void> {
    // Implementation for sending notifications
    console.log('🔔 Sending notification for email:', email.subject);
  }

  private async addLabel(email: Email, parameters: any): Promise<void> {
    // Implementation for adding labels
    console.log('🏷️ Adding label to email:', email.subject);
  }

  private async identifyMeetingOpportunities(
    email: Email, 
    entities: ExtractedEntity[]
  ): Promise<ScheduledMeeting[]> {
    const meetings: ScheduledMeeting[] = [];

    // Look for meeting-related keywords in email content
    const content = (email.body_text || email.body_html || '').toLowerCase();
    const meetingKeywords = [
      'meeting', 'call', 'discussion', 'demo', 'presentation', 
      'schedule', 'appointment', 'conference', 'video call'
    ];

    const hasMeetingKeywords = meetingKeywords.some(keyword => 
      content.includes(keyword)
    );

    if (hasMeetingKeywords) {
      // Extract date/time entities
      const dateEntities = entities.filter(e => e.type === 'date');
      const personEntities = entities.filter(e => e.type === 'person');
      const orgEntities = entities.filter(e => e.type === 'organization');

      if (dateEntities.length > 0 || personEntities.length > 0) {
        const meeting: ScheduledMeeting = {
          id: `meeting_${Date.now()}`,
          title: email.subject || 'Meeting from Email',
          description: email.body_text,
          entity_ids: [...personEntities, ...orgEntities].map(e => e.value),
          proposed_times: dateEntities.map(date => ({
            start_time: new Date().toISOString(), // This should parse the actual date
            end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour later
            timezone: 'UTC'
          })),
          duration_minutes: 60,
          meeting_type: 'sales_call',
          status: 'proposed',
          created_at: new Date().toISOString()
        };

        meetings.push(meeting);
      }
    }

    return meetings;
  }

  async searchEmails(criteria: EmailSearchCriteria): Promise<Email[]> {
    let sql = 'SELECT * FROM emails WHERE 1=1';
    const params: any[] = [];

    if (criteria.account_id) {
      sql += ' AND account_id = ?';
      params.push(criteria.account_id);
    }

    if (criteria.sender) {
      sql += ' AND sender LIKE ?';
      params.push(`%${criteria.sender}%`);
    }

    if (criteria.subject) {
      sql += ' AND subject LIKE ?';
      params.push(`%${criteria.subject}%`);
    }

    if (criteria.date_from) {
      sql += ' AND received_at >= ?';
      params.push(criteria.date_from);
    }

    if (criteria.date_to) {
      sql += ' AND received_at <= ?';
      params.push(criteria.date_to);
    }

    if (criteria.is_read !== undefined) {
      sql += ' AND is_read = ?';
      params.push(criteria.is_read);
    }

    sql += ' ORDER BY received_at DESC';

    if (criteria.limit) {
      sql += ' LIMIT ?';
      params.push(criteria.limit);
    }

    if (criteria.offset) {
      sql += ' OFFSET ?';
      params.push(criteria.offset);
    }

    return executeQuery<Email>(sql, params);
  }

  async getEmailById(id: string): Promise<Email | null> {
    const sql = 'SELECT * FROM emails WHERE id = ? LIMIT 1';
    const results = await executeQuery<Email>(sql, [id]);
    return results[0] || null;
  }

  async getEmailsByEntity(entityId: string): Promise<Email[]> {
    const sql = `
      SELECT e.* FROM emails e
      JOIN client_communications cc ON e.external_id = cc.external_id
      WHERE cc.entity_id = ?
      ORDER BY e.received_at DESC
    `;
    return executeQuery<Email>(sql, [entityId]);
  }
}