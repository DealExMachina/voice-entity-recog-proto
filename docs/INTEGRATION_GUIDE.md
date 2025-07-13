# Email and Calendar Integration Guide

This guide covers the integration of email and calendar agents into the Sales Buddy system for comprehensive client relationship management.

## Overview

The email and calendar integration enables the system to:

- **Monitor emails** for client communications and extract relevant entities
- **Track calendar events** for meetings and appointments with clients
- **Automatically extract entities** from email content and calendar events
- **Create communication records** linking entities to their interactions
- **Schedule meetings** and manage follow-ups
- **Provide unified client timelines** across all communication channels

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Email Agent   │    │ Integration      │    │ Calendar Agent  │
│                 │    │ Service          │    │                 │
│ • Gmail API     │◄──►│                  │◄──►│ • Google Calendar│
│ • IMAP          │    │ • Entity Tracking│    │ • Outlook       │
│ • Outlook       │    │ • Meeting Mgmt   │    │ • iCal          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Mastra Agent   │
                       │                  │
                       │ • Entity Extraction│
                       │ • AI Processing  │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │     DuckDB       │
                       │                  │
                       │ • Unified Storage│
                       │ • Analytics      │
                       └──────────────────┘
```

## Database Schema

### New Tables Added

#### Email Integration
- `email_accounts` - Email provider configurations
- `emails` - Stored email messages
- `client_communications` - Links entities to communications

#### Calendar Integration  
- `calendar_accounts` - Calendar provider configurations
- `calendar_events` - Stored calendar events
- `scheduled_meetings` - Meeting scheduling and tracking

#### Relationships
- `entity_relationships` - Links between entities
- `client_communications` - Tracks all client interactions

## Configuration

### Environment Variables

#### Email Configuration
```bash
# Email Provider (gmail, outlook, imap)
EMAIL_PROVIDER=gmail

# Gmail OAuth2 Configuration
EMAIL_CLIENT_ID=your-gmail-client-id
EMAIL_CLIENT_SECRET=your-gmail-client-secret
EMAIL_ACCESS_TOKEN=your-gmail-access-token
EMAIL_REFRESH_TOKEN=your-gmail-refresh-token

# IMAP Configuration (alternative)
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SERVER=imap.gmail.com
EMAIL_PORT=993
EMAIL_USE_SSL=true

# Sync Settings
EMAIL_SYNC_FREQUENCY=15
EMAIL_SYNC_HISTORY_DAYS=7
EMAIL_SYNC_ATTACHMENTS=false
EMAIL_MAX_ATTACHMENT_SIZE=10
EMAIL_FOLDERS_TO_SYNC=INBOX,Sent
EMAIL_EXCLUDE_FOLDERS=Spam,Trash
```

#### Calendar Configuration
```bash
# Calendar Provider (google, outlook, ical)
CALENDAR_PROVIDER=google

# Google Calendar OAuth2 Configuration
CALENDAR_CLIENT_ID=your-google-client-id
CALENDAR_CLIENT_SECRET=your-google-client-secret
CALENDAR_ACCESS_TOKEN=your-google-access-token
CALENDAR_REFRESH_TOKEN=your-google-refresh-token
CALENDAR_ID=primary

# Sync Settings
CALENDAR_SYNC_FREQUENCY=15
CALENDAR_SYNC_HISTORY_DAYS=7
CALENDAR_SYNC_FUTURE_DAYS=30
CALENDAR_CALENDARS_TO_SYNC=primary
CALENDAR_EXCLUDE_CALENDARS=
```

## Setup Instructions

### 1. Gmail API Setup

1. **Create Google Cloud Project**
   ```bash
   # Go to Google Cloud Console
   # Create new project or select existing
   ```

2. **Enable Gmail API**
   ```bash
   # In Google Cloud Console
   # APIs & Services > Library
   # Search for "Gmail API" and enable
   ```

3. **Create OAuth2 Credentials**
   ```bash
   # APIs & Services > Credentials
   # Create Credentials > OAuth 2.0 Client IDs
   # Application type: Web application
   # Add authorized redirect URIs
   ```

4. **Get Access Token**
   ```bash
   # Use OAuth2 flow to get access and refresh tokens
   # Store in environment variables
   ```

### 2. Google Calendar API Setup

1. **Enable Google Calendar API**
   ```bash
   # In Google Cloud Console
   # APIs & Services > Library
   # Search for "Google Calendar API" and enable
   ```

2. **Use Same OAuth2 Credentials**
   ```bash
   # Can use same client ID/secret as Gmail
   # Just need different scope for calendar access
   ```

### 3. Application Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp docker.env.example docker.env
   # Edit docker.env with your API keys
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

## API Endpoints

### Integration Management

#### Get Integration Status
```http
GET /integration/status
```

#### Start Sync Processes
```http
POST /integration/sync/start
```

#### Stop Sync Processes
```http
POST /integration/sync/stop
```

### Analytics and Activity

#### Get Recent Activity
```http
GET /integration/activity?limit=20
```

#### Get Analytics
```http
GET /integration/analytics
```

### Entity Management

#### Search Entities
```http
GET /integration/entities/search?q=john
```

#### Get Entity Summary
```http
GET /integration/entities/{entityId}/summary
```

#### Get Client Timeline
```http
GET /integration/entities/{entityId}/timeline
```

### Communication Management

#### Get Client Communications
```http
GET /integration/communications/{entityId}
```

#### Schedule Meeting
```http
POST /integration/meetings
Content-Type: application/json

{
  "title": "Sales Call with John",
  "description": "Discuss new product features",
  "entity_ids": ["john@company.com"],
  "proposed_times": [
    {
      "start_time": "2024-01-15T10:00:00Z",
      "end_time": "2024-01-15T11:00:00Z",
      "timezone": "UTC"
    }
  ],
  "duration_minutes": 60,
  "meeting_type": "sales_call"
}
```

#### Send Email
```http
POST /integration/email/send
Content-Type: application/json

{
  "to": ["john@company.com"],
  "subject": "Follow up on our meeting",
  "body": "Hi John, thanks for the great meeting...",
  "cc": ["manager@company.com"],
  "bcc": []
}
```

#### Create Calendar Event
```http
POST /integration/calendar/events
Content-Type: application/json

{
  "title": "Sales Meeting with John",
  "description": "Discuss new product features",
  "start_time": "2024-01-15T10:00:00Z",
  "end_time": "2024-01-15T11:00:00Z",
  "attendees": [
    {
      "email": "john@company.com",
      "name": "John Smith"
    }
  ]
}
```

## Processing Rules

### Email Processing Rules

The system automatically processes emails based on configurable rules:

```javascript
{
  "id": "client_communication",
  "name": "Client Communication Detection",
  "conditions": [
    {
      "field": "sender",
      "operator": "contains",
      "value": "@"
    }
  ],
  "actions": [
    {
      "type": "extract_entities",
      "parameters": {}
    },
    {
      "type": "create_communication_record",
      "parameters": {}
    }
  ],
  "is_active": true,
  "priority": 1
}
```

### Calendar Processing Rules

Similar rules for calendar events:

```javascript
{
  "id": "client_meeting",
  "name": "Client Meeting Detection",
  "conditions": [
    {
      "field": "title",
      "operator": "contains",
      "value": "client"
    }
  ],
  "actions": [
    {
      "type": "extract_entities",
      "parameters": {}
    },
    {
      "type": "create_communication_record",
      "parameters": {}
    }
  ],
  "is_active": true,
  "priority": 1
}
```

## Entity Types

The system extracts and tracks these entity types:

- **Person** - Individual contacts
- **Organization** - Companies and institutions
- **Location** - Physical addresses and places
- **Financial** - Money amounts and financial terms
- **Product** - Products and services
- **Contact** - Contact information
- **Date** - Dates and time references

## Client Timeline

Each entity gets a unified timeline showing:

- **Emails** - All email communications
- **Events** - Calendar events and meetings
- **Communications** - All interaction records
- **Meetings** - Scheduled and completed meetings

## Analytics

The system provides comprehensive analytics:

- **Total counts** - Entities, emails, events, communications, meetings
- **Entity distribution** - Breakdown by entity type
- **Communication patterns** - Types and frequencies
- **Meeting statistics** - Scheduled vs completed meetings

## Security Considerations

### OAuth2 Token Management
- Store tokens securely in environment variables
- Implement token refresh mechanisms
- Use minimal required scopes

### Data Privacy
- Only sync necessary folders/calendars
- Implement data retention policies
- Secure database access

### Rate Limiting
- Respect API rate limits
- Implement exponential backoff
- Monitor usage patterns

## Troubleshooting

### Common Issues

1. **OAuth2 Token Expired**
   ```bash
   # Refresh tokens using refresh token
   # Update environment variables
   ```

2. **API Rate Limits**
   ```bash
   # Check sync frequency settings
   # Implement proper rate limiting
   ```

3. **Database Connection Issues**
   ```bash
   # Check database path and permissions
   # Verify DuckDB installation
   ```

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

### Health Checks

Check service status:
```bash
curl http://localhost:3000/integration/status
```

## Best Practices

1. **Start Small** - Begin with one email account and calendar
2. **Monitor Sync** - Watch for rate limits and errors
3. **Regular Backups** - Backup database regularly
4. **Test Rules** - Validate processing rules before production
5. **Security First** - Use secure token storage and minimal scopes

## Future Enhancements

- **Multi-provider support** - Outlook, Exchange, iCal
- **Advanced analytics** - Predictive insights
- **Automated actions** - Auto-replies, follow-ups
- **Integration APIs** - CRM system connections
- **Mobile support** - Push notifications
- **AI-powered insights** - Sentiment analysis, intent detection