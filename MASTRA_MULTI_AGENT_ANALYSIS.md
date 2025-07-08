# Mastra Multi-Agent Coordination Analysis
## Email Detection & Calendar Meeting Integration for Sales-Buddy

### Executive Summary

This analysis outlines how to leverage Mastra's multi-agent orchestration capabilities to enhance the sales-buddy application with two specialized agents:
1. **Email Agent**: Monitors mailboxes and detects incoming emails from clients present in the entity database
2. **Calendar Agent**: Acquires meetings from calendars and links them to opportunities

The current architecture already provides a solid foundation with MastraAgent for entity extraction, DuckDB for data persistence, and MCP services for coordination.

---

## Current Architecture Assessment

### Existing Components
- **MastraAgent**: Handles voice transcription and entity extraction using OpenAI/Mistral
- **MCP Service**: Manages database operations and tool execution
- **DuckDB Database**: Stores entities (person, organization, location, financial, product, contact, date) and conversations
- **Entity Types**: Well-defined schema for business entities
- **WebSocket Support**: Real-time communication capabilities

### Strengths
- ✅ Robust entity extraction pipeline
- ✅ Flexible AI provider switching (OpenAI, Mistral, Demo mode)
- ✅ Structured data storage with relationships
- ✅ Rate limiting and error handling
- ✅ TypeScript-first architecture

### Gaps for Multi-Agent Implementation
- ❌ No email integration capabilities
- ❌ No calendar service connections
- ❌ Limited agent orchestration (single agent)
- ❌ No opportunity management system
- ❌ No workflow coordination between agents

---

## Mastra Framework Capabilities Analysis

### Multi-Agent Orchestration Features
Based on research, Mastra provides:

1. **Agent Architecture**
   ```typescript
   const agent = new Agent({
     name: 'Agent Name',
     instructions: 'Agent behavior description',
     model: openai('gpt-4o-mini'),
     memory,
     tools: { toolSet },
     workflow: { workflowDefinition }
   });
   ```

2. **Workflow Orchestration**
   ```typescript
   workflow
     .step(emailCheck)
     .then(entityMatch)
     .after(entityMatch)
       .step(notifyOpportunity)
       .step(updateDatabase)
     .after([notifyOpportunity, updateDatabase])
     .step(finalize)
     .commit();
   ```

3. **Tool Integration**
   - External API calls
   - Database operations
   - Real-time monitoring
   - Event-driven triggers

4. **Memory & Context Management**
   - Persistent agent memory
   - Cross-agent context sharing
   - Conversation threading

---

## Proposed Multi-Agent Architecture

### Agent Design

#### 1. Email Detection Agent (`EmailAgent`)
**Purpose**: Monitor mailboxes and detect incoming emails from known clients

**Capabilities**:
- Connect to email providers (Gmail, Outlook, IMAP)
- Parse email metadata (sender, subject, timestamp)
- Match senders against entity database
- Extract business context from email content
- Trigger opportunity updates

**Tools**:
- Email provider connectors
- Entity matching algorithms
- Content analysis tools
- Database query tools

#### 2. Calendar Meeting Agent (`CalendarAgent`)
**Purpose**: Acquire meetings and link them to opportunities

**Capabilities**:
- Connect to calendar providers (Google Calendar, Outlook Calendar)
- Monitor meeting creation/updates
- Match meeting participants to entities
- Extract meeting context and purpose
- Link meetings to existing opportunities

**Tools**:
- Calendar API connectors
- Participant matching tools
- Opportunity linking algorithms
- Meeting context extractors

#### 3. Orchestrator Agent (`OpportunityOrchestrator`)
**Purpose**: Coordinate between email and calendar agents

**Capabilities**:
- Receive events from both agents
- Correlate email and meeting data
- Update opportunity status
- Trigger notifications and workflows
- Maintain data consistency

### Workflow Coordination

```typescript
// Email Detection Workflow
const emailWorkflow = createWorkflow('email-detection')
  .step('checkNewEmails', emailCheckTool)
  .then('matchEntities', entityMatchTool)
  .after('matchEntities')
    .step('updateOpportunity', opportunityUpdateTool)
    .step('notifyCalendarAgent', crossAgentNotificationTool)
  .after(['updateOpportunity', 'notifyCalendarAgent'])
    .step('persistChanges', databasePersistTool)
  .commit();

// Calendar Meeting Workflow  
const calendarWorkflow = createWorkflow('calendar-monitoring')
  .step('checkNewMeetings', calendarCheckTool)
  .then('matchParticipants', participantMatchTool)
  .after('matchParticipants')
    .step('linkToOpportunity', opportunityLinkTool)
    .step('notifyEmailAgent', crossAgentNotificationTool)
  .after(['linkToOpportunity', 'notifyEmailAgent'])
    .step('persistChanges', databasePersistTool)
  .commit();
```

---

## Implementation Strategy

### Phase 1: Database Schema Extension

#### New Tables Required
```sql
-- Opportunities table
CREATE TABLE opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'active', -- active, closed_won, closed_lost
  value DECIMAL,
  probability DECIMAL,
  expected_close_date DATE,
  source_type VARCHAR, -- email, meeting, call
  source_id UUID,
  assigned_entity_id UUID REFERENCES entities(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

-- Email tracking table
CREATE TABLE emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id VARCHAR UNIQUE,
  sender_email VARCHAR NOT NULL,
  recipient_email VARCHAR NOT NULL,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMP,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sender_entity_id UUID REFERENCES entities(id),
  opportunity_id UUID REFERENCES opportunities(id),
  metadata JSON
);

-- Meetings table
CREATE TABLE meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_meeting_id VARCHAR UNIQUE,
  title VARCHAR NOT NULL,
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  location VARCHAR,
  organizer_email VARCHAR,
  attendees JSON, -- Array of attendee emails
  opportunity_id UUID REFERENCES opportunities(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

-- Agent coordination events
CREATE TABLE agent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL, -- email_detected, meeting_found, opportunity_updated
  payload JSON,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 2: Agent Tool Development

#### Email Tools
```typescript
// Email provider connector tool
const emailConnectorTool = createTool({
  id: "connect-email-provider",
  description: "Connect to email provider and fetch new emails",
  inputSchema: z.object({
    provider: z.enum(['gmail', 'outlook', 'imap']),
    credentials: z.object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional()
    }),
    since: z.string().optional() // ISO timestamp
  }),
  execute: async ({ context }) => {
    // Implementation for various email providers
    return await fetchEmails(context);
  }
});

// Entity matching tool
const entityMatchTool = createTool({
  id: "match-email-entities",
  description: "Match email senders against entity database",
  inputSchema: z.object({
    emails: z.array(z.object({
      sender: z.string(),
      subject: z.string(),
      body: z.string()
    }))
  }),
  execute: async ({ context }) => {
    // Query entity database for matching contacts
    return await matchEmailSenders(context.emails);
  }
});
```

#### Calendar Tools
```typescript
// Calendar connector tool
const calendarConnectorTool = createTool({
  id: "connect-calendar-provider",
  description: "Connect to calendar provider and fetch meetings",
  inputSchema: z.object({
    provider: z.enum(['google', 'outlook', 'caldav']),
    credentials: z.object({
      accessToken: z.string(),
      refreshToken: z.string().optional()
    }),
    timeRange: z.object({
      start: z.string(),
      end: z.string()
    })
  }),
  execute: async ({ context }) => {
    return await fetchMeetings(context);
  }
});

// Meeting-opportunity linking tool
const meetingLinkTool = createTool({
  id: "link-meeting-opportunity",
  description: "Link meetings to existing opportunities",
  inputSchema: z.object({
    meeting: z.object({
      id: z.string(),
      attendees: z.array(z.string()),
      title: z.string(),
      description: z.string().optional()
    })
  }),
  execute: async ({ context }) => {
    return await linkMeetingToOpportunity(context.meeting);
  }
});
```

### Phase 3: Agent Implementation

#### Email Agent
```typescript
export const emailAgent = new Agent({
  name: 'Email Detection Agent',
  instructions: `You are responsible for monitoring email inboxes and detecting emails from known clients.
  
  Your responsibilities:
  1. Connect to configured email providers
  2. Fetch new emails since last check
  3. Match email senders against the entity database
  4. Extract relevant business context from email content
  5. Create or update opportunities based on email content
  6. Notify other agents of relevant email events
  
  Always prioritize emails from known clients and look for sales signals.`,
  model: openai('gpt-4o-mini'),
  tools: {
    emailConnectorTool,
    entityMatchTool,
    opportunityUpdateTool,
    notificationTool
  },
  memory: persistentMemory,
  workflow: { emailWorkflow }
});
```

#### Calendar Agent
```typescript
export const calendarAgent = new Agent({
  name: 'Calendar Meeting Agent',
  instructions: `You are responsible for monitoring calendar systems and linking meetings to opportunities.
  
  Your responsibilities:
  1. Connect to configured calendar providers
  2. Monitor new meetings and meeting updates
  3. Match meeting participants against the entity database
  4. Extract meeting context and business relevance
  5. Link meetings to existing opportunities
  6. Update opportunity status based on meeting outcomes
  
  Focus on meetings with external participants who are known clients or prospects.`,
  model: openai('gpt-4o-mini'),
  tools: {
    calendarConnectorTool,
    participantMatchTool,
    meetingLinkTool,
    opportunityUpdateTool
  },
  memory: persistentMemory,
  workflow: { calendarWorkflow }
});
```

#### Orchestrator Agent
```typescript
export const opportunityOrchestrator = new Agent({
  name: 'Opportunity Orchestrator',
  instructions: `You coordinate between email and calendar agents to maintain a comprehensive view of opportunities.
  
  Your responsibilities:
  1. Receive and process events from email and calendar agents
  2. Correlate information across different data sources
  3. Maintain opportunity data consistency
  4. Trigger appropriate workflows based on events
  5. Generate insights and recommendations
  6. Handle conflict resolution between agent updates
  
  Always ensure data consistency and prevent duplicate opportunities.`,
  model: openai('gpt-4o'),
  tools: {
    correlationTool,
    consistencyCheckTool,
    insightGenerationTool,
    workflowTriggerTool
  },
  memory: sharedMemory,
  workflow: { orchestrationWorkflow }
});
```

### Phase 4: Integration Dependencies

#### Required Package Additions
```json
{
  "dependencies": {
    "@mastra/core": "^latest",
    "@mastra/memory": "^latest", 
    "@mastra/workflows": "^latest",
    "googleapis": "^131.0.0",
    "@azure/msal-node": "^2.0.0",
    "imap": "^0.8.19",
    "mailparser": "^3.6.5",
    "node-cron": "^3.0.3",
    "ical": "^0.8.0",
    "caldav-client": "^2.1.0"
  }
}
```

#### Configuration Requirements
```typescript
// Email provider configurations
interface EmailConfig {
  provider: 'gmail' | 'outlook' | 'imap';
  credentials: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    username?: string;
    password?: string;
    host?: string;
    port?: number;
  };
  checkInterval: number; // minutes
  maxEmails: number;
}

// Calendar provider configurations  
interface CalendarConfig {
  provider: 'google' | 'outlook' | 'caldav';
  credentials: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    calendarUrl?: string;
    username?: string;
    password?: string;
  };
  checkInterval: number; // minutes
  lookAheadDays: number;
}
```

---

## Coordination Patterns

### Event-Driven Coordination
```typescript
// Agent event bus for coordination
class AgentEventBus {
  private events: Map<string, EventHandler[]> = new Map();
  
  subscribe(eventType: string, handler: EventHandler) {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType)!.push(handler);
  }
  
  async emit(event: AgentEvent) {
    const handlers = this.events.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }
}

// Event types for coordination
interface AgentEvent {
  type: 'email_detected' | 'meeting_found' | 'opportunity_updated';
  agentId: string;
  data: any;
  timestamp: Date;
}
```

### Shared Context Management
```typescript
// Shared memory for cross-agent context
class SharedAgentMemory {
  private contexts: Map<string, OpportunityContext> = new Map();
  
  setOpportunityContext(opportunityId: string, context: OpportunityContext) {
    this.contexts.set(opportunityId, context);
  }
  
  getOpportunityContext(opportunityId: string): OpportunityContext | null {
    return this.contexts.get(opportunityId) || null;
  }
  
  mergeContext(opportunityId: string, updates: Partial<OpportunityContext>) {
    const existing = this.contexts.get(opportunityId) || {};
    this.contexts.set(opportunityId, { ...existing, ...updates });
  }
}

interface OpportunityContext {
  entityIds: string[];
  lastEmailDate?: Date;
  lastMeetingDate?: Date;
  emailCount: number;
  meetingCount: number;
  stage: 'prospecting' | 'qualifying' | 'proposing' | 'negotiating' | 'closing';
  priority: 'low' | 'medium' | 'high';
  notes: string[];
}
```

---

## Benefits & Advantages

### Immediate Benefits
1. **Automated Lead Tracking**: Automatically detect and track communications from known clients
2. **Meeting Intelligence**: Link calendar events to sales opportunities for better visibility
3. **Reduced Manual Work**: Eliminate manual data entry for email and meeting tracking
4. **Real-time Updates**: Get immediate notifications when clients engage
5. **Data Correlation**: Connect email conversations with scheduled meetings

### Long-term Advantages
1. **Sales Pipeline Visibility**: Complete view of client engagement across channels
2. **Predictive Analytics**: Use historical patterns to predict opportunity outcomes
3. **Automated Follow-ups**: Trigger follow-up workflows based on email/meeting patterns
4. **Client Relationship Insights**: Understand communication patterns and preferences
5. **Scalable Architecture**: Easily add more agents for other data sources (social media, phone calls, etc.)

---

## Challenges & Mitigations

### Technical Challenges

#### 1. API Rate Limiting
**Challenge**: Email and calendar providers have strict rate limits
**Mitigation**: 
- Implement exponential backoff
- Use batch operations where possible
- Cache frequently accessed data
- Implement intelligent polling intervals

#### 2. Data Deduplication
**Challenge**: Same contact might appear in multiple systems with different identifiers
**Mitigation**:
- Implement fuzzy matching algorithms
- Use multiple identifiers (email, phone, name)
- Manual review workflow for uncertain matches
- Confidence scoring for matches

#### 3. Authentication Management
**Challenge**: Managing OAuth tokens and credentials for multiple providers
**Mitigation**:
- Secure credential storage (environment variables, key vaults)
- Automatic token refresh mechanisms
- Fallback authentication methods
- User-friendly credential setup workflow

### Privacy & Security Considerations

#### 1. Email Content Privacy
**Challenge**: Processing potentially sensitive email content
**Mitigation**:
- Process only metadata by default
- Explicit opt-in for content analysis
- Encrypt stored email data
- Regular data purging policies

#### 2. Calendar Data Sensitivity  
**Challenge**: Calendar data can reveal sensitive business information
**Mitigation**:
- Focus on meeting metadata, not content
- Allow selective calendar sharing
- Implement data access controls
- Audit trail for data access

---

## Success Metrics & KPIs

### Technical Metrics
- **Email Processing Rate**: Emails processed per minute
- **Calendar Sync Accuracy**: % of meetings correctly linked to opportunities
- **Entity Match Accuracy**: % of correctly identified client emails
- **System Uptime**: % availability of agent coordination system
- **Response Time**: Average time from email/meeting to opportunity update

### Business Metrics
- **Lead Response Time**: Reduction in time to respond to client emails
- **Meeting Preparation**: % of meetings with pre-populated context
- **Opportunity Tracking**: % of client interactions automatically tracked
- **Sales Velocity**: Improvement in sales cycle times
- **Data Quality**: Reduction in manual data entry errors

---

## Implementation Timeline

### Week 1-2: Foundation Setup
- Extend database schema for opportunities, emails, meetings
- Set up basic Mastra agent structure
- Implement core tools for database operations

### Week 3-4: Email Agent Development
- Implement email provider connectors
- Build entity matching algorithms  
- Create email processing workflows
- Basic email detection functionality

### Week 5-6: Calendar Agent Development
- Implement calendar provider connectors
- Build meeting-opportunity linking logic
- Create calendar monitoring workflows
- Basic meeting detection functionality

### Week 7-8: Orchestration & Integration
- Implement orchestrator agent
- Set up cross-agent communication
- Build coordination workflows
- Integration testing

### Week 9-10: Testing & Refinement
- End-to-end testing
- Performance optimization
- Security review
- Documentation and training

### Week 11-12: Deployment & Monitoring
- Production deployment
- Monitoring and alerting setup
- User training and onboarding
- Performance tuning

---

## Conclusion

Implementing multi-agent coordination with Mastra for email detection and calendar meeting acquisition represents a significant enhancement to the sales-buddy application. The approach leverages Mastra's robust workflow orchestration, tool integration, and memory management capabilities to create a sophisticated, automated sales intelligence system.

The proposed architecture maintains the existing strengths of the current system while adding powerful new capabilities for automated lead tracking and opportunity management. With proper implementation, this system will significantly improve sales team productivity and provide unprecedented visibility into client engagement patterns.

The modular design ensures that the system can evolve and expand to include additional data sources and more sophisticated analysis capabilities as the business grows and requirements change.