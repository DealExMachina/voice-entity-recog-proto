import { 
  insertEntity, 
  insertConversation, 
  getAllEntities, 
  getEntitiesByType,
  getConversationById,
  initializeDatabase 
} from '../database/duckdb-simple.ts';

export class McpService {
  constructor() {
    this.capabilities = {
      resources: true,
      tools: true,
      prompts: false
    };
  }

  async initialize() {
    console.log('🔗 MCP Service initializing...');
    // Initialize the database with DuckDB Neo
    await initializeDatabase();
    console.log('✅ MCP Service initialized with DuckDB Neo');
    return true;
  }

  // MCP Resource handling
  async getResources() {
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
  getTools() {
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
            conversationId: { type: 'string', description: 'Source conversation ID' },
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

  // Execute MCP tool calls
  async executeTool(toolName, args) {
    switch (toolName) {
      case 'store_entity':
        return this.storeEntity(args);
      
      case 'get_entities':
        return this.getEntities(args);
      
      case 'store_conversation':
        return this.storeConversation(args);
      
      case 'get_conversation':
        return this.getConversation(args);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Business logic methods
  async storeEntity(entity) {
    try {
      const entityId = await insertEntity({
        type: entity.type,
        value: entity.value,
        confidence: entity.confidence || 1.0,
        context: entity.context || '',
        source_conversation_id: entity.conversationId || null,
        metadata: entity.metadata || {}
      });

      return {
        success: true,
        entityId,
        message: `Entity "${entity.value}" stored successfully`
      };
    } catch (error) {
      console.error('Error storing entity:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async storeEntities(entities) {
    const results = [];
    
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

  async getEntities(options = {}) {
    try {
      let entities;
      
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
      console.error('Error retrieving entities:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async storeConversation(conversation) {
    try {
      const conversationId = await insertConversation({
        transcription: conversation.transcription,
        audio_duration: conversation.audioDuration || null,
        metadata: conversation.metadata || {}
      });

      return {
        success: true,
        conversationId,
        message: 'Conversation stored successfully'
      };
    } catch (error) {
      console.error('Error storing conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getConversation(options) {
    try {
      const conversation = await getConversationById(options.id);
      
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      return {
        success: true,
        conversation
      };
    } catch (error) {
      console.error('Error retrieving conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const entities = await getAllEntities(1000);
      const entityTypes = {};
      
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
      return { error: error.message };
    }
  }
} 