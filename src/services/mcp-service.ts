import { 
  insertEntity, 
  insertConversation, 
  getAllEntities, 
  getEntitiesByType 
} from '../database/duckdb.js';
import type { 
  Entity, 
  EntityType, 
  ExtractedEntity, 
  McpRequest, 
  McpResponse, 
  McpError 
} from '../types/index.js';

interface McpCapabilities {
  resources: boolean;
  tools: boolean;
  prompts: boolean;
}

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface StoreEntityArgs {
  type: EntityType;
  value: string;
  confidence?: number;
  context?: string;
  source_conversation_id?: string;
  metadata?: Record<string, unknown>;
}

interface GetEntitiesArgs {
  type?: EntityType;
  limit?: number;
}

interface StoreConversationArgs {
  transcription: string;
  audio_duration?: number;
  metadata?: Record<string, unknown>;
}

interface OperationResult {
  success: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

interface EntityOperationResult extends OperationResult {
  entityId?: string;
}

interface EntitiesOperationResult extends OperationResult {
  entities?: Entity[];
  count?: number;
}

interface ConversationOperationResult extends OperationResult {
  conversationId?: string;
}

interface StatsResult {
  totalEntities: number;
  entityTypes: Record<string, number>;
  lastUpdated: string;
  error?: string;
}

export class McpService {
  private capabilities: McpCapabilities;

  constructor() {
    this.capabilities = {
      resources: true,
      tools: true,
      prompts: false
    };
  }

  async initialize(): Promise<boolean> {
    console.log('🔗 MCP Service initializing...');
    // Future: Connect to actual MCP server if needed
    return true;
  }

  // MCP Resource handling
  async getResources(): Promise<McpResource[]> {
    return [
      {
        uri: 'duckdb://entities',
        name: 'Entity Database',
        description: 'DuckDB database containing extracted entities',
        mimeType: 'application/json'
      }
    ];
  }

  // MCP Tool definitions
  getTools(): McpTool[] {
    return [
      {
        name: 'store_entity',
        description: 'Store an extracted entity in the database',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Entity type (person, organization, location, etc.)' },
            value: { type: 'string', description: 'Entity value/name' },
            confidence: { type: 'number', description: 'Confidence score (0-1)' },
            context: { type: 'string', description: 'Context where entity was found' },
            source_conversation_id: { type: 'string', description: 'Source conversation ID' },
            metadata: { type: 'object', description: 'Additional metadata' }
          },
          required: ['type', 'value']
        }
      },
      {
        name: 'get_entities',
        description: 'Retrieve entities from the database',
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
            audio_duration: { type: 'number', description: 'Audio duration in seconds' },
            metadata: { type: 'object', description: 'Additional metadata' }
          },
          required: ['transcription']
        }
      }
    ];
  }

  // Execute MCP tool calls
  async executeTool(toolName: string, args: unknown): Promise<OperationResult> {
    try {
      switch (toolName) {
        case 'store_entity':
          return this.storeEntity(args as StoreEntityArgs);
        
        case 'get_entities':
          return this.getEntities(args as GetEntitiesArgs);
        
        case 'store_conversation':
          return this.storeConversation(args as StoreConversationArgs);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Business logic methods
  async storeEntity(entity: StoreEntityArgs): Promise<EntityOperationResult> {
    try {
      console.log('🔍 insertEntity called with:', JSON.stringify(entity, null, 2));
      
      const entityId = await insertEntity({
        type: entity.type,
        value: entity.value,
        confidence: entity.confidence || 1.0,
        context: entity.context || '',
        source_conversation_id: entity.source_conversation_id || '',
        metadata: entity.metadata || {}
      });

      console.log('🔍 insertEntity result:', entityId);

      return {
        success: true,
        entityId,
        message: `Entity "${entity.value}" stored successfully`
      };
    } catch (error) {
      console.error('❌ Error storing entity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store entity'
      };
    }
  }

  async storeEntities(entities: ExtractedEntity[], conversationId?: string): Promise<OperationResult> {
    const results: EntityOperationResult[] = [];
    
    for (const entity of entities) {
      const entityArgs: StoreEntityArgs = {
        ...entity,
        ...(conversationId && { source_conversation_id: conversationId })
      };
      const result = await this.storeEntity(entityArgs);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: successCount === entities.length,
      count: entities.length,
      successCount,
      results
    };
  }

  async getEntities(options: GetEntitiesArgs = {}): Promise<EntitiesOperationResult> {
    try {
      let entities: Entity[];
      
      if (options.type) {
        entities = await getEntitiesByType(options.type, options.limit || 100);
      } else {
        entities = await getAllEntities(options.limit || 100);
      }

      return {
        success: true,
        entities,
        count: entities.length
      };
    } catch (error) {
      console.error('❌ Error retrieving entities:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve entities'
      };
    }
  }

  async storeConversation(conversation: StoreConversationArgs): Promise<ConversationOperationResult> {
    try {
      console.log('🔍 insertConversation called with:', JSON.stringify(conversation, null, 2));
      
      const conversationId = await insertConversation({
        transcription: conversation.transcription,
        audio_duration: conversation.audio_duration || 0,
        metadata: conversation.metadata || {}
      });

      console.log('🔍 insertConversation result:', conversationId);

      return {
        success: true,
        conversationId,
        message: 'Conversation stored successfully'
      };
    } catch (error) {
      console.error('❌ Error storing conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store conversation'
      };
    }
  }

  // Get database statistics
  async getStats(): Promise<StatsResult> {
    try {
      const entities = await getAllEntities(1000);
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
      console.error('❌ Error getting stats:', error);
      return {
        totalEntities: 0,
        entityTypes: {},
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to get statistics'
      };
    }
  }

  getCapabilities(): McpCapabilities {
    return { ...this.capabilities };
  }
} 