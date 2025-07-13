# API Documentation

This document provides comprehensive documentation for the Sales Buddy API endpoints.

## Base URL

- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Authentication

Most endpoints require no authentication. Future versions may implement API key authentication.

## Rate Limiting

The API implements rate limiting on AI-powered endpoints:
- **AI Endpoints**: 100 requests per 15 minutes
- **Upload Endpoints**: 50 requests per 15 minutes
- **General Endpoints**: 200 requests per 15 minutes

## Response Format

All API responses follow this structure:

```json
{
  "success": boolean,
  "data": any,
  "error": string,
  "message": string
}
```

## Core Entity Processing

### Health Check
```
GET /api/health
```

Returns the health status of the application.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Transcribe Audio
```
POST /api/transcribe
```

Transcribes audio file to text using OpenAI Whisper.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` (file, max 10MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": "Hello, this is a test transcription",
    "filename": "audio.wav",
    "size": 1024000
  }
}
```

### Process Audio
```
POST /api/process-audio
```

Transcribes audio and extracts entities in one step.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` (file, max 10MB), `duration` (optional, number)

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": "Meeting with John Smith at Acme Corp",
    "entities": [
      {
        "type": "person",
        "value": "John Smith",
        "confidence": 0.95,
        "context": "Meeting with John Smith at Acme Corp"
      }
    ],
    "analysis": {
      "sentiment": "neutral",
      "topics": ["meeting", "business"],
      "summary": "Business meeting discussion"
    },
    "conversationId": "uuid-123",
    "processedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Extract Entities from Text
```
POST /api/extract-entities
```

Extracts entities from provided text.

**Request:**
```json
{
  "text": "Meeting with John Smith at Acme Corp tomorrow"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Meeting with John Smith at Acme Corp tomorrow",
    "entities": [
      {
        "type": "person",
        "value": "John Smith",
        "confidence": 0.95,
        "context": "Meeting with John Smith at Acme Corp tomorrow"
      },
      {
        "type": "organization",
        "value": "Acme Corp",
        "confidence": 0.90,
        "context": "Meeting with John Smith at Acme Corp tomorrow"
      }
    ],
    "analysis": {
      "sentiment": "neutral",
      "topics": ["meeting", "business"],
      "summary": "Business meeting discussion"
    },
    "conversationId": "uuid-123",
    "processedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Entities
```
GET /api/entities
```

Retrieves stored entities with optional filtering.

**Query Parameters:**
- `type` (optional): Filter by entity type (`person`, `organization`, `location`, etc.)
- `limit` (optional): Number of entities to return (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "entities": [
      {
        "id": "entity-1",
        "type": "person",
        "value": "John Smith",
        "confidence": 0.95,
        "context": "Meeting context",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1,
    "filtered": true
  }
}
```

### Add Entity
```
POST /api/entities
```

Manually adds an entity to the database.

**Request:**
```json
{
  "type": "person",
  "value": "Jane Doe",
  "confidence": 0.90,
  "context": "Manual entry",
  "source_conversation_id": "uuid-123",
  "metadata": {
    "added_by": "user",
    "notes": "Important client"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "entityId": "entity-456",
    "message": "Entity added successfully"
  }
}
```

### Get Statistics
```
GET /api/stats
```

Returns database statistics and counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_entities": 150,
    "total_conversations": 25,
    "entities_by_type": {
      "person": 60,
      "organization": 40,
      "location": 30,
      "other": 20
    },
    "recent_activity": {
      "today": 5,
      "week": 25,
      "month": 100
    }
  }
}
```

## AI Provider Management

### Get AI Provider Status
```
GET /api/ai/status
```

Returns current AI provider configuration and status.

**Response:**
```json
{
  "success": true,
  "data": {
    "current": "openai",
    "available": ["openai", "mistral", "demo"],
    "config": {
      "model": "gpt-4o-mini",
      "temperature": 0.7
    }
  }
}
```

### Switch AI Provider
```
POST /api/ai/provider
```

Switches between AI providers.

**Request:**
```json
{
  "provider": "openai"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "switched": true
  }
}
```

### List AI Providers
```
GET /api/ai/providers
```

Lists all available AI providers.

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "openai",
        "name": "OpenAI",
        "available": true,
        "models": ["gpt-4o-mini", "gpt-4"]
      },
      {
        "id": "mistral",
        "name": "Mistral AI",
        "available": true,
        "models": ["mistral-small", "mistral-large"]
      }
    ]
  }
}
```

## Agent System

### Process with Master Agent
```
POST /api/master-agent/process
```

Processes input using the master agent orchestration system.

**Request:**
```json
{
  "input": "Schedule a meeting with John Smith",
  "context": "Previous conversation about project timeline",
  "options": {
    "agent_type": "scheduling",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "I'll help you schedule a meeting with John Smith",
    "actions": [
      {
        "type": "schedule_meeting",
        "parameters": {
          "participant": "John Smith",
          "subject": "Project Timeline Discussion"
        }
      }
    ],
    "agent_used": "master-agent",
    "processedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Master Agent Status
```
GET /api/master-agent/status
```

Returns the status of the master agent system.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "agents": {
      "voice_processor": true,
      "entity_extractor": true,
      "response_generator": true,
      "email_agent": true,
      "calendar_agent": true
    },
    "last_activity": "2024-01-15T10:30:00Z"
  }
}
```

### Generate Agent Response
```
POST /api/agent/respond
```

Generates a response using the response generator agent.

**Request:**
```json
{
  "message": "What meetings do I have today?",
  "context": "User asking about schedule",
  "persona": "professional-assistant"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "You have 3 meetings today: 9 AM with John Smith, 2 PM team standup, and 4 PM client call.",
    "confidence": 0.95,
    "persona_used": "professional-assistant"
  }
}
```

## Personas Management

### Get All Personas
```
GET /api/personas
```

Retrieves all available personas.

**Response:**
```json
{
  "success": true,
  "data": {
    "personas": [
      {
        "id": "persona-1",
        "name": "Professional Assistant",
        "description": "Formal business assistant",
        "voice": {
          "tone": "professional",
          "speed": "normal"
        },
        "personality": {
          "traits": ["helpful", "efficient", "formal"]
        },
        "expertise": ["scheduling", "email", "business"]
      }
    ]
  }
}
```

### Get Persona by ID
```
GET /api/personas/:id
```

Retrieves a specific persona by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "persona": {
      "id": "persona-1",
      "name": "Professional Assistant",
      "description": "Formal business assistant",
      "voice": {
        "tone": "professional",
        "speed": "normal"
      },
      "personality": {
        "traits": ["helpful", "efficient", "formal"]
      },
      "expertise": ["scheduling", "email", "business"]
    }
  }
}
```

### Create Persona
```
POST /api/personas
```

Creates a new persona.

**Request:**
```json
{
  "name": "Casual Assistant",
  "description": "Friendly and casual assistant",
  "voice": {
    "tone": "friendly",
    "speed": "normal"
  },
  "personality": {
    "traits": ["friendly", "casual", "helpful"]
  },
  "expertise": ["general", "conversation"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "personaId": "persona-2"
  },
  "message": "Persona created successfully"
}
```

### Update Persona
```
PUT /api/personas/:id
```

Updates an existing persona.

**Request:**
```json
{
  "name": "Updated Assistant",
  "description": "Updated description",
  "voice": {
    "tone": "professional",
    "speed": "slow"
  },
  "personality": {
    "traits": ["patient", "detailed", "thorough"]
  },
  "expertise": ["analysis", "research"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Persona updated successfully"
}
```

### Delete Persona
```
DELETE /api/personas/:id
```

Deletes a persona.

**Response:**
```json
{
  "success": true,
  "message": "Persona deleted successfully"
}
```

## Text-to-Speech

### Synthesize Speech
```
POST /api/tts/synthesize
```

Converts text to speech.

**Request:**
```json
{
  "text": "Hello, this is a test message",
  "voice": "en-US-AriaNeural",
  "speed": 1.0,
  "pitch": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "/api/tts/audio/audio-123.wav",
    "duration": 3.5,
    "format": "wav"
  }
}
```

### Get Available Voices
```
GET /api/tts/voices
```

Lists available TTS voices.

**Response:**
```json
{
  "success": true,
  "data": {
    "voices": [
      {
        "id": "en-US-AriaNeural",
        "name": "Aria (US English)",
        "language": "en-US",
        "gender": "female"
      },
      {
        "id": "en-US-GuyNeural",
        "name": "Guy (US English)",
        "language": "en-US",
        "gender": "male"
      }
    ]
  }
}
```

## Integration Features

### Get Integration Status
```
GET /integration/status
```

Returns the status of email and calendar integrations.

**Response:**
```json
{
  "success": true,
  "data": {
    "email_agent": true,
    "calendar_agent": true,
    "email_sync_running": false,
    "calendar_sync_running": false
  }
}
```

### Start Sync Processes
```
POST /integration/sync/start
```

Starts all sync processes for email and calendar.

**Response:**
```json
{
  "success": true,
  "message": "Sync processes started"
}
```

### Stop Sync Processes
```
POST /integration/sync/stop
```

Stops all sync processes.

**Response:**
```json
{
  "success": true,
  "message": "Sync processes stopped"
}
```

### Get Recent Activity
```
GET /integration/activity
```

Returns recent activity across all integrations.

**Query Parameters:**
- `limit` (optional): Number of items to return (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "email-1",
        "subject": "Meeting Follow-up",
        "sender": "john@example.com",
        "received_at": "2024-01-15T10:30:00Z"
      }
    ],
    "events": [
      {
        "id": "event-1",
        "title": "Team Meeting",
        "start_time": "2024-01-15T14:00:00Z",
        "end_time": "2024-01-15T15:00:00Z"
      }
    ],
    "communications": [
      {
        "id": "comm-1",
        "type": "email",
        "entity_id": "entity-1",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### Get Analytics
```
GET /integration/analytics
```

Returns analytics data for integrations.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_entities": 150,
    "total_emails": 500,
    "total_events": 100,
    "total_communications": 300,
    "total_meetings": 50,
    "entities_by_type": {
      "person": 60,
      "organization": 40,
      "location": 30,
      "other": 20
    },
    "communications_by_type": {
      "email": 200,
      "calendar": 100
    }
  }
}
```

### Search Entities
```
GET /integration/entities/search
```

Searches for entities across all integrations.

**Query Parameters:**
- `q` (required): Search query

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "entity-1",
      "type": "person",
      "value": "John Smith",
      "confidence": 0.95,
      "last_seen": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Entity Summary
```
GET /integration/entities/:entityId/summary
```

Gets a comprehensive summary for a specific entity.

**Response:**
```json
{
  "success": true,
  "data": {
    "entity": {
      "id": "entity-1",
      "type": "person",
      "value": "John Smith"
    },
    "communication_count": 15,
    "email_count": 10,
    "event_count": 5,
    "meeting_count": 3,
    "last_communication": "2024-01-15T10:30:00Z",
    "upcoming_meetings": [
      {
        "id": "meeting-1",
        "title": "Project Review",
        "scheduled_time": "2024-01-16T14:00:00Z"
      }
    ]
  }
}
```

### Get Client Timeline
```
GET /integration/entities/:entityId/timeline
```

Gets a timeline of all interactions with a specific entity.

**Response:**
```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "email-1",
        "subject": "Project Update",
        "received_at": "2024-01-15T10:30:00Z"
      }
    ],
    "events": [
      {
        "id": "event-1",
        "title": "Team Meeting",
        "start_time": "2024-01-15T14:00:00Z"
      }
    ],
    "communications": [
      {
        "id": "comm-1",
        "type": "email",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "meetings": [
      {
        "id": "meeting-1",
        "title": "Project Review",
        "scheduled_time": "2024-01-16T14:00:00Z"
      }
    ]
  }
}
```

### Schedule Meeting
```
POST /integration/meetings
```

Schedules a new meeting.

**Request:**
```json
{
  "title": "Sales Call with John",
  "description": "Discuss new product features",
  "entity_ids": ["entity-1"],
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

**Response:**
```json
{
  "success": true,
  "data": {
    "meetingId": "meeting-123",
    "status": "scheduled"
  }
}
```

### Send Email
```
POST /integration/email/send
```

Sends an email through the integrated email system.

**Request:**
```json
{
  "to": ["john@example.com"],
  "subject": "Follow up on our meeting",
  "body": "Hi John, thanks for the great meeting...",
  "cc": ["manager@example.com"],
  "bcc": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-123",
    "sent": true
  }
}
```

### Create Calendar Event
```
POST /integration/calendar/events
```

Creates a new calendar event.

**Request:**
```json
{
  "title": "Sales Meeting with John",
  "description": "Discuss new product features",
  "start_time": "2024-01-15T10:00:00Z",
  "end_time": "2024-01-15T11:00:00Z",
  "attendees": [
    {
      "email": "john@example.com",
      "name": "John Smith"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventId": "event-123",
    "created": true
  }
}
```

### Get Client Communications
```
GET /integration/communications/:entityId
```

Gets all communications for a specific entity.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "comm-1",
      "type": "email",
      "subject": "Project Update",
      "sender": "john@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "entities_extracted": ["entity-1", "entity-2"]
    }
  ]
}
```

## MCP Integration

### Get MCP Capabilities
```
GET /api/mcp/capabilities
```

Returns the capabilities of the MCP service.

**Response:**
```json
{
  "success": true,
  "data": {
    "capabilities": {
      "entity_storage": true,
      "conversation_tracking": true,
      "analytics": true
    },
    "tools": [
      {
        "name": "store_entity",
        "description": "Store an entity in the database"
      },
      {
        "name": "get_entities",
        "description": "Retrieve entities from the database"
      }
    ],
    "resources": [
      {
        "name": "entities",
        "description": "Entity storage resource"
      }
    ]
  }
}
```

### Execute MCP Tool
```
POST /api/mcp/tools/:toolName
```

Executes a specific MCP tool.

**Request:**
```json
{
  "type": "person",
  "value": "John Smith",
  "confidence": 0.95
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": "Entity stored successfully",
    "entityId": "entity-123"
  }
}
```

## Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required (future feature)
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Error Response Format

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## WebSocket Events

The application also supports WebSocket connections for real-time updates:

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Events
- `voice_data`: Real-time voice data
- `entities_extracted`: New entities extracted
- `streaming_started`: Streaming process started
- `streaming_error`: Streaming error occurred
- `transcription_chunk`: Partial transcription data

## Rate Limiting Details

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|---------|
| AI Processing | 100 requests | 15 minutes |
| File Upload | 50 requests | 15 minutes |
| General API | 200 requests | 15 minutes |
| Health Check | 1000 requests | 15 minutes |

### Rate Limit Headers

All responses include rate limiting headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Changelog

### Version 1.0.0
- Initial API implementation
- Core entity extraction
- Email and calendar integration
- Agent system
- TTS functionality
- MCP integration