import * as db from '../database/duckdb-simple.js';

// Type definitions for MCP tools
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Type definitions for MCP responses
export interface MCPResponse {
  success: boolean;
  [key: string]: any;
}

// TypeScript MCP Service class with full type safety
export class McpService {
  private initialized: boolean = false;
  
  public readonly capabilities = {
    resources: true,
    tools: true,
    prompts: false
  };

  constructor() {
    console.log('🔗 MCP Service (TypeScript) initializing...');
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      await db.initializeDatabase();
      this.initialized = true;
      console.log('✅ MCP service initialized with DuckDB Neo');
      return true;
    } catch (error) {
      console.error('❌ MCP service initialization failed:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // MCP Resource handling with types
  async getResources(): Promise<Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }>> {
    return [
      {
        uri: 'duckdb://entities',
        name: 'Entity Database',
        description: 'DuckDB database containing extracted entities with full type safety',
        mimeType: 'application/json'
      },
      {
        uri: 'duckdb://conversations',
        name: 'Conversation Database',
        description: 'DuckDB database containing conversation transcriptions',
        mimeType: 'application/json'
      }
    ];
  }

  // MCP Tool definitions with TypeScript types
  getTools(): MCPTool[] {
    return [
      {
        name: 'store_entity',
        description: 'Store an extracted entity in the database with full type safety',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Entity type (person, organization, location, etc.)' },
            value: { type: 'string', description: 'Entity value/name' },
            confidence: { type: 'number', description: 'Confidence score (0-1)' },
            context: { type: 'string', description: 'Context where entity was found' },
            conversationId: { type: 'string', description: 'Source conversation ID' },
            metadata: { type: 'object', description: 'Additional metadata' }
          },
          required: ['type', 'value', 'confidence', 'context']
        }
      },
      {
        name: 'get_entities',
        description: 'Retrieve entities from the database with type safety',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Filter by entity type' },
            limit: { type: 'number', description: 'Maximum number of results' }
          }
        }
      },
      {
        name: 'store_conversation',
        description: 'Store a conversation transcript in the database',
        inputSchema: {
          type: 'object',
          properties: {
            transcription: { type: 'string', description: 'Conversation transcript' },
            audioDuration: { type: 'number', description: 'Audio duration in seconds' },
            metadata: { type: 'object', description: 'Additional metadata' }
          },
          required: ['transcription']
        }
      },
      {
        name: 'get_conversation',
        description: 'Retrieve a conversation by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Conversation ID' }
          },
          required: ['id']
        }
      }
    ];
  }

  // Execute MCP tool calls with full type safety
  async executeTool(toolName: string, args: any): Promise<MCPResponse> {
    if (!this.initialized) {
      throw new Error('MCP service not initialized. Call initialize() first.');
    }

    console.log(`🔧 Executing MCP tool: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'store_entity':
          return await this.storeEntity(args);
        
        case 'get_entities':
          return await this.getEntities(args);
        
        case 'store_conversation':
          return await this.storeConversation(args);
        
        case 'get_conversation':
          return await this.getConversation(args);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ Tool execution failed for ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Business logic methods with TypeScript types
  private async storeEntity(args: {
    type: string;
    value: string;
    confidence: number;
    context: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  }): Promise<MCPResponse & { entityId?: string; message?: string }> {
    try {
      const entity: Omit<db.Entity, 'id' | 'created_at'> = {
        type: args.type,
        value: args.value,
        confidence: args.confidence,
        context: args.context,
        source_conversation_id: args.conversationId || null,
        metadata: args.metadata || {}
      };

      const entityId = await db.insertEntity(entity);

      return {
        success: true,
        entityId,
        message: `Entity "${args.value}" stored successfully with TypeScript type safety`
      };
    } catch (error) {
      console.error('Error storing entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async storeEntities(entities: Array<{
    type: string;
    value: string;
    confidence: number;
    context: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  }>): Promise<MCPResponse & { count?: number; results?: MCPResponse[] }> {
    const results: MCPResponse[] = [];
    
    for (const entity of entities) {
      const result = await this.storeEntity(entity);
      results.push(result);
    }

    return {
      success: true,
      count: entities.length,
      results
    };
  }

  private async getEntities(options: {
    type?: string;
    limit?: number;
  } = {}): Promise<MCPResponse & { entities?: db.Entity[]; count?: number }> {
    try {
      let entities: db.Entity[];
      
      if (options.type) {
        entities = await db.getEntitiesByType(options.type, options.limit || 100);
      } else {
        entities = await db.getAllEntities(options.limit || 100);
      }

      return {
        success: true,
        entities,
        count: entities.length
      };
    } catch (error) {
      console.error('Error retrieving entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async storeConversation(args: {
    transcription: string;
    audioDuration?: number;
    metadata?: Record<string, any>;
  }): Promise<MCPResponse & { conversationId?: string; message?: string }> {
    try {
      const conversation: Omit<db.Conversation, 'id' | 'created_at'> = {
        transcription: args.transcription,
        audio_duration: args.audioDuration || null,
        metadata: args.metadata || {}
      };

      const conversationId = await db.insertConversation(conversation);

      return {
        success: true,
        conversationId,
        message: 'Conversation stored successfully with DuckDB Neo'
      };
    } catch (error) {
      console.error('Error storing conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async getConversation(args: {
    id: string;
  }): Promise<MCPResponse & { conversation?: db.Conversation }> {
    try {
      const conversation = await db.getConversationById(args.id);

      return {
        success: true,
        conversation: conversation || undefined
      };
    } catch (error) {
      console.error('Error retrieving conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Get database statistics with TypeScript types
  async getStats(): Promise<{
    totalEntities?: number;
    entityTypes?: Record<string, number>;
    lastUpdated?: string;
    error?: string;
  }> {
    try {
      const entities = await db.getAllEntities(1000);
      const entityTypes: Record<string, number> = {};
      
      entities.forEach(entity => {
        entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
      });

      return {
        totalEntities: entities.length,
        entityTypes,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async close(): Promise<void> {
    if (this.initialized) {
      await db.closeDatabase();
      this.initialized = false;
      console.log('✅ MCP service closed');
    }
  }
} 