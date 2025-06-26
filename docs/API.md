# API Documentation

## REST Endpoints

### Health Check
```
GET /api/health
```
Returns system status and service availability.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "mcp": "active", 
    "mastra": "ready"
  }
}
```

### Audio Processing

#### Transcribe Audio
```
POST /api/transcribe
Content-Type: multipart/form-data
```
Transcribes audio file to text.

**Parameters:**
- `audio` (file): Audio file (wav, mp3, m4a, etc.)

**Response:**
```json
{
  "success": true,
  "transcription": "Meeting with John Smith...",
  "filename": "recording.wav",
  "size": 1048576
}
```

#### Process Audio (Full Pipeline)
```
POST /api/process-audio
Content-Type: multipart/form-data
```
Transcribes audio and extracts entities.

**Parameters:**
- `audio` (file): Audio file
- `duration` (optional): Audio duration in seconds

**Response:**
```json
{
  "success": true,
  "transcription": "Meeting with John Smith from Acme Corp...",
  "entities": [
    {
      "type": "person",
      "value": "John Smith",
      "confidence": 0.95,
      "context": "Meeting with John Smith from Acme",
      "extractedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "analysis": {
    "totalEntities": 3,
    "entityCounts": {"person": 1, "organization": 1},
    "insights": ["Conversation involves 1 people and 1 organizations"]
  },
  "conversationId": "uuid-here"
}
```

### Entity Management

#### Extract Entities from Text
```
POST /api/extract-entities
Content-Type: application/json
```

**Body:**
```json
{
  "text": "Meeting with John Smith from Acme Corp next Tuesday"
}
```

**Response:**
```json
{
  "success": true,
  "text": "Meeting with John Smith...",
  "entities": [...],
  "analysis": {...}
}
```

#### Get Entities
```
GET /api/entities?type={type}&limit={limit}
```

**Query Parameters:**
- `type` (optional): Filter by entity type
- `limit` (optional): Limit results (default: 100)

**Response:**
```json
{
  "success": true,
  "entities": [
    {
      "id": "uuid",
      "type": "person",
      "value": "John Smith",
      "confidence": 0.95,
      "context": "Meeting with John Smith",
      "source_conversation_id": "uuid",
      "created_at": "2024-01-01T00:00:00.000Z",
      "metadata": {}
    }
  ],
  "count": 1
}
```

#### Add Entity Manually
```
POST /api/entities
Content-Type: application/json
```

**Body:**
```json
{
  "type": "person",
  "value": "Jane Doe",
  "confidence": 1.0,
  "context": "Added manually",
  "metadata": {"source": "manual"}
}
```

### Statistics

#### Get Database Statistics
```
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalEntities": 150,
    "entityTypes": {
      "person": 45,
      "organization": 20,
      "location": 15
    },
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

### MCP Interface

#### Get MCP Capabilities
```
GET /api/mcp/capabilities
```

**Response:**
```json
{
  "capabilities": {
    "resources": true,
    "tools": true,
    "prompts": false
  },
  "tools": [
    {
      "name": "store_entity",
      "description": "Store an extracted entity in the database",
      "inputSchema": {...}
    }
  ],
  "resources": [...]
}
```

#### Execute MCP Tool
```
POST /api/mcp/tools/{toolName}
Content-Type: application/json
```

**Example - Store Entity:**
```
POST /api/mcp/tools/store_entity
```

**Body:**
```json
{
  "type": "person",
  "value": "Alice Johnson",
  "confidence": 0.9,
  "context": "Project meeting discussion"
}
```

## WebSocket Events

### Client to Server

#### Voice Data
```json
{
  "type": "voice_data",
  "audio": "base64-encoded-audio-data"
}
```

### Server to Client

#### Entities Extracted
```json
{
  "type": "entities_extracted",
  "transcription": "Meeting transcript...",
  "entities": [...]
}
```

#### Error
```json
{
  "type": "error", 
  "message": "Error description"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request (missing parameters)
- `500`: Internal Server Error
- `413`: File too large
- `415`: Unsupported media type 