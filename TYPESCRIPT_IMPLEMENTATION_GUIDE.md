# TypeScript Migration - Immediate Implementation Guide

## Quick Start: Day 1 Implementation

This guide provides immediate, actionable steps to begin the TypeScript migration for the sales-buddy repository.

## Step 1: Setup TypeScript Infrastructure (30 minutes)

### 1.1 Install Dependencies

```bash
# Install TypeScript and type definitions
npm install --save-dev typescript @types/node @types/express @types/ws @types/multer @types/cors ts-node ts-node-dev tsup

# Install runtime validation
npm install zod

# Install build tools
npm install --save-dev concurrently rimraf
```

### 1.2 Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "allowImportingTsExtensions": false,
    "noEmit": false,
    "isolatedModules": true
  },
  "include": [
    "src/**/*",
    "types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "public",
    "tests/**/*.js"
  ],
  "ts-node": {
    "esm": true,
    "experimentalSpecifierResolution": "node"
  }
}
```

### 1.3 Update package.json Scripts

```json
{
  "scripts": {
    "build": "tsup src/index.ts --format esm --target es2022 --outDir dist",
    "dev": "ts-node-dev --esm --respawn --transpile-only src/index.ts",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "clean": "rimraf dist",
    "build:watch": "tsup src/index.ts --format esm --target es2022 --outDir dist --watch"
  }
}
```

## Step 2: Create Core Type Definitions (45 minutes)

### 2.1 Create types/entities.ts

```typescript
export interface Entity {
  id?: string;
  type: EntityType;
  value: string;
  confidence: number;
  context?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  extractedAt?: string;
  provider?: AIProvider;
}

export type EntityType = 
  | 'person'
  | 'organization' 
  | 'location'
  | 'event'
  | 'product'
  | 'financial'
  | 'contact'
  | 'date'
  | 'time';

export type AIProvider = 'openai' | 'mistral' | 'demo';

export interface EntityAnalysis {
  totalEntities: number;
  entityCounts: Record<EntityType, number>;
  insights: string[];
  relationships: EntityRelationship[];
}

export interface EntityRelationship {
  entity1Id: string;
  entity2Id: string;
  relationshipType: string;
  confidence: number;
}

export interface Conversation {
  id?: string;
  transcription: string;
  audioDuration?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
}
```

### 2.2 Create types/api.ts

```typescript
import { Entity, EntityAnalysis, Conversation } from './entities.js';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProcessAudioRequest {
  audio: File;
  duration?: number;
}

export interface ProcessAudioResponse {
  success: boolean;
  transcription: string;
  entities: Entity[];
  analysis: EntityAnalysis;
  conversationId: string;
  processedAt: string;
}

export interface ExtractEntitiesRequest {
  text: string;
}

export interface ExtractEntitiesResponse {
  success: boolean;
  text: string;
  entities: Entity[];
  analysis: EntityAnalysis;
}

export interface GetEntitiesRequest {
  type?: string;
  limit?: number;
}

export interface GetEntitiesResponse {
  success: boolean;
  entities: Entity[];
  count: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  services: {
    database: string;
    mcp: string;
    mastra: string;
  };
}

export interface StatsResponse {
  success: boolean;
  stats: {
    totalEntities: number;
    entityTypes: Record<string, number>;
    lastUpdated: string;
  };
}
```

### 2.3 Create types/database.ts

```typescript
export interface DatabaseEntity {
  id: string;
  type: string;
  value: string;
  confidence: number;
  context: string | null;
  source_conversation_id: string | null;
  created_at: Date;
  metadata: string; // JSON string
}

export interface DatabaseConversation {
  id: string;
  transcription: string;
  audio_duration: number | null;
  created_at: Date;
  metadata: string; // JSON string
}

export interface DatabaseConfig {
  path: string;
  maxConnections?: number;
  timeout?: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}
```

### 2.4 Create types/mcp.ts

```typescript
export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface McpCapabilities {
  resources: boolean;
  tools: boolean;
  prompts: boolean;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface McpToolRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface McpToolResponse {
  success: boolean;
  result?: any;
  error?: string;
}
```

## Step 3: Migrate Database Layer (60 minutes)

### 3.1 Create src/database/duckdb.ts

```typescript
import Database from 'duckdb';
import fs from 'fs';
import path from 'path';
import { DatabaseEntity, DatabaseConversation, QueryResult } from '../../types/database.js';
import { Entity, Conversation } from '../../types/entities.js';

let db: Database.Database;

export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DB_PATH || './data/entities.db';
    const dbDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize DuckDB
    db = new Database.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create tables
      const createTablesSQL = `
        -- Entities table
        CREATE TABLE IF NOT EXISTS entities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type VARCHAR NOT NULL,
          value TEXT NOT NULL,
          confidence FLOAT,
          context TEXT,
          source_conversation_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Conversations table
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          transcription TEXT NOT NULL,
          audio_duration FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON
        );

        -- Entity relationships table
        CREATE TABLE IF NOT EXISTS entity_relationships (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          entity1_id UUID REFERENCES entities(id),
          entity2_id UUID REFERENCES entities(id),
          relationship_type VARCHAR,
          confidence FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
        CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
        CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      `;

      db.exec(createTablesSQL, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📊 Database tables created successfully');
          resolve();
        }
      });
    });
  });
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    if (params.length === 0) {
      database.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    } else {
      database.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    }
  });
}

export async function insertEntity(entity: Omit<Entity, 'id' | 'createdAt'>): Promise<string> {
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
    entity.conversationId,
    JSON.stringify(entity.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  return result[0]?.id;
}

export async function getEntitiesByType(type: string, limit: number = 100): Promise<DatabaseEntity[]> {
  const sql = `
    SELECT * FROM entities 
    WHERE type = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<DatabaseEntity>(sql, [type, limit]);
}

export async function getAllEntities(limit: number = 100): Promise<DatabaseEntity[]> {
  const sql = `
    SELECT * FROM entities 
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return executeQuery<DatabaseEntity>(sql, [limit]);
}

export async function insertConversation(conversation: Omit<Conversation, 'id' | 'createdAt'>): Promise<string> {
  const sql = `
    INSERT INTO conversations (transcription, audio_duration, metadata)
    VALUES (?, ?, ?)
    RETURNING id
  `;
  
  const params = [
    conversation.transcription,
    conversation.audioDuration,
    JSON.stringify(conversation.metadata || {})
  ];

  const result = await executeQuery<{ id: string }>(sql, params);
  return result[0]?.id;
}

// Type conversion helpers
export function convertDatabaseEntityToEntity(dbEntity: DatabaseEntity): Entity {
  return {
    id: dbEntity.id,
    type: dbEntity.type as any,
    value: dbEntity.value,
    confidence: dbEntity.confidence,
    context: dbEntity.context || undefined,
    conversationId: dbEntity.source_conversation_id || undefined,
    metadata: dbEntity.metadata ? JSON.parse(dbEntity.metadata) : {},
    createdAt: dbEntity.created_at
  };
}

export function convertDatabaseConversationToConversation(dbConversation: DatabaseConversation): Conversation {
  return {
    id: dbConversation.id,
    transcription: dbConversation.transcription,
    audioDuration: dbConversation.audio_duration || undefined,
    metadata: dbConversation.metadata ? JSON.parse(dbConversation.metadata) : {},
    createdAt: dbConversation.created_at
  };
}
```

## Step 4: Update Build Configuration (15 minutes)

### 4.1 Create tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: false,
  keepNames: true,
  minify: false,
  external: ['duckdb'],
  esbuildOptions: (options) => {
    options.mainFields = ['module', 'main'];
  }
});
```

### 4.2 Update Dockerfile for TypeScript

```dockerfile
# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsup.config.ts ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and types
COPY src/ ./src/
COPY types/ ./types/

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --only=production

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]
```

## Step 5: Test the Setup (15 minutes)

### 5.1 Create a simple test migration

Create `src/index.ts` as a copy of `src/index.js` with TypeScript imports:

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// This will be gradually migrated
import { initializeDatabase } from './database/duckdb.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      mcp: 'active',
      mastra: 'ready'
    }
  });
});

async function startServer() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    server.listen(PORT, () => {
      console.log(`🚀 TypeScript server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);
```

### 5.2 Test the build

```bash
# Type check
npm run type-check

# Build
npm run build

# Test run
npm run dev
```

## Next Steps

After completing this setup:

1. **Migrate MCP Service** - Convert `src/services/mcp-service.js` to TypeScript
2. **Migrate Mastra Agent** - Convert `src/agents/mastra-agent.js` to TypeScript  
3. **Migrate API Routes** - Convert `src/routes/api.js` to TypeScript
4. **Add Validation** - Implement Zod schemas for runtime validation
5. **Frontend Migration** - Convert frontend JavaScript to TypeScript

## Common Issues & Solutions

### Import/Export Issues
- Use `.js` extensions in imports even for `.ts` files
- Ensure `"type": "module"` is in package.json
- Use `import type` for type-only imports

### Database Types
- DuckDB types may need additional configuration
- Use type assertions for complex database queries
- Consider creating typed query builders

### Build Issues
- Clean dist folder before builds: `npm run clean`
- Check TypeScript configuration if imports fail
- Verify all dependencies have type definitions

## Success Criteria

✅ TypeScript compiles without errors  
✅ Application starts successfully  
✅ Health endpoint returns 200  
✅ Database initializes properly  
✅ Type checking passes in IDE  

Once these steps are complete, you'll have a solid foundation for migrating the rest of the codebase to TypeScript while maintaining full functionality.