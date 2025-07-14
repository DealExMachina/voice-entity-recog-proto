# DuckDB Testing Dependencies - Analysis & Refactoring Plan

## Current Issues Identified

### 1. **Database Dependency Conflicts**
- **Error**: `Dependency Error: Cannot alter entry "entities" because there are entries that depend on it`
- **Root Cause**: Tests attempting to create tables when schema dependencies already exist
- **Impact**: Tests fail to initialize properly, blocking test execution

### 2. **Tight Coupling Throughout Application**
- **Files with direct DuckDB dependencies**: 8+ modules
- **Affected Components**:
  - `src/index.ts` - Main application entry
  - `src/routes/api.ts` - API routes
  - `src/services/mcp-service.ts` - MCP service layer
  - `src/services/integration-service.ts` - Integration services
  - `src/services/tts-service.ts` - Text-to-speech services
  - `src/agents/email-agent.ts` - Email processing
  - `src/agents/calendar-agent.ts` - Calendar integration
  - `src/agents/response-generator-agent.ts` - Response generation
  - `tests/test-basic.ts` - Test suite

### 3. **Lack of Test Isolation**
- **Problem**: Tests use the same global database instance as production code
- **Consequence**: Test data persists between runs, causing interference
- **Risk**: Tests affect production data when run against shared database

### 4. **No Abstraction Layer**
- **Issue**: Direct imports from `database/duckdb.js` throughout codebase
- **Effect**: Impossible to mock or stub database for testing
- **Result**: Tests always require real DuckDB instance

### 5. **Poor Test Architecture**
- **Current Setup**: Single test file with mixed concerns
- **Missing**: Unit tests, integration test separation, test utilities
- **Problem**: Manual database path manipulation for test isolation

## Architecture Evaluation

### Current Architecture Problems
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agents        │    │   Services      │    │   Routes        │
│  (7 files)      │    │   (3 files)     │    │   (1 file)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │ duckdb.ts   │
                          │ (Global DB) │
                          └─────────────┘
```

**Issues:**
- Single global database instance
- No dependency injection
- Direct coupling between business logic and data layer
- No interface abstraction

## Refactoring Plan

### Phase 1: Create Database Abstraction Layer

#### 1.1 Define Database Interfaces
Create `src/interfaces/database.ts`:
```typescript
interface DatabaseRepository {
  // Entity operations
  insertEntity(entity: InsertEntityParams): Promise<string>;
  getEntitiesByType(type: EntityType, limit?: number): Promise<Entity[]>;
  getAllEntities(limit?: number): Promise<Entity[]>;
  
  // Conversation operations
  insertConversation(conversation: InsertConversationParams): Promise<string>;
  getConversations(limit?: number): Promise<Conversation[]>;
  
  // Persona operations
  insertPersona(persona: PersonaParams): Promise<string>;
  getPersonas(): Promise<Persona[]>;
  getPersonaById(id: string): Promise<Persona | null>;
  
  // Generic query execution
  executeQuery<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  
  // Connection management
  initialize(config?: DatabaseConfig): Promise<void>;
  close(): Promise<void>;
}

interface DatabaseFactory {
  createRepository(config?: DatabaseConfig): DatabaseRepository;
}
```

#### 1.2 Implement DuckDB Repository
Refactor `src/database/duckdb.ts` to implement the interface:
```typescript
export class DuckDBRepository implements DatabaseRepository {
  private db: DuckDB.Database | null = null;
  
  async initialize(config?: DatabaseConfig): Promise<void> {
    // Existing initialization logic
  }
  
  // Implement all interface methods
}

export class DuckDBFactory implements DatabaseFactory {
  createRepository(config?: DatabaseConfig): DatabaseRepository {
    return new DuckDBRepository();
  }
}
```

#### 1.3 Create Mock Repository for Testing
Create `src/testing/mock-database.ts`:
```typescript
export class MockDatabaseRepository implements DatabaseRepository {
  private entities: Map<string, Entity> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private personas: Map<string, Persona> = new Map();
  
  // Implement in-memory versions of all interface methods
  
  // Test utility methods
  reset(): void {
    this.entities.clear();
    this.conversations.clear();
    this.personas.clear();
  }
  
  seedData(data: TestData): void {
    // Helper for seeding test data
  }
}
```

### Phase 2: Implement Dependency Injection

#### 2.1 Create Service Container
Create `src/container/service-container.ts`:
```typescript
export class ServiceContainer {
  private static instance: ServiceContainer;
  private databaseFactory: DatabaseFactory;
  private databaseRepository: DatabaseRepository;
  
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }
  
  setDatabaseFactory(factory: DatabaseFactory): void {
    this.databaseFactory = factory;
  }
  
  getDatabaseRepository(): DatabaseRepository {
    if (!this.databaseRepository) {
      this.databaseRepository = this.databaseFactory.createRepository();
    }
    return this.databaseRepository;
  }
  
  // For testing
  setDatabaseRepository(repository: DatabaseRepository): void {
    this.databaseRepository = repository;
  }
  
  reset(): void {
    this.databaseRepository = null;
  }
}
```

#### 2.2 Update Services to Use Dependency Injection
Example for `McpService`:
```typescript
export class McpService {
  private database: DatabaseRepository;
  
  constructor(database?: DatabaseRepository) {
    this.database = database || ServiceContainer.getInstance().getDatabaseRepository();
  }
  
  async storeEntity(entity: StoreEntityArgs): Promise<EntityOperationResult> {
    // Use this.database instead of direct imports
    const entityId = await this.database.insertEntity({
      type: entity.type,
      value: entity.value,
      // ... other fields
    });
    // ... rest of implementation
  }
}
```

### Phase 3: Restructure Test Architecture

#### 3.1 Create Test Utilities
Create `tests/utils/test-setup.ts`:
```typescript
export class TestSetup {
  private mockDb: MockDatabaseRepository;
  private container: ServiceContainer;
  
  async setup(): Promise<void> {
    this.mockDb = new MockDatabaseRepository();
    this.container = ServiceContainer.getInstance();
    this.container.setDatabaseRepository(this.mockDb);
    
    // Initialize test data if needed
    await this.seedTestData();
  }
  
  async teardown(): Promise<void> {
    this.mockDb.reset();
    this.container.reset();
  }
  
  getDatabaseRepository(): MockDatabaseRepository {
    return this.mockDb;
  }
  
  private async seedTestData(): Promise<void> {
    // Seed common test data
  }
}
```

#### 3.2 Create Separate Test Files
Structure tests by concern:
```
tests/
├── utils/
│   ├── test-setup.ts
│   └── test-data.ts
├── unit/
│   ├── agents/
│   │   ├── mastra-agent.test.ts
│   │   ├── email-agent.test.ts
│   │   └── calendar-agent.test.ts
│   ├── services/
│   │   ├── mcp-service.test.ts
│   │   └── integration-service.test.ts
│   └── database/
│       └── duckdb-repository.test.ts
├── integration/
│   ├── api-endpoints.test.ts
│   └── end-to-end.test.ts
└── test-basic.ts (refactored)
```

#### 3.3 Example Refactored Test
```typescript
// tests/unit/services/mcp-service.test.ts
import { TestSetup } from '../../utils/test-setup.js';
import { McpService } from '../../../src/services/mcp-service.js';

describe('McpService', () => {
  let testSetup: TestSetup;
  let mcpService: McpService;
  
  beforeEach(async () => {
    testSetup = new TestSetup();
    await testSetup.setup();
    mcpService = new McpService(); // Will use injected mock DB
  });
  
  afterEach(async () => {
    await testSetup.teardown();
  });
  
  test('should store entity successfully', async () => {
    const entity = {
      type: 'person' as EntityType,
      value: 'John Doe',
      confidence: 0.9,
      context: 'Test context'
    };
    
    const result = await mcpService.storeEntity(entity);
    
    expect(result.success).toBe(true);
    expect(result.entityId).toBeDefined();
    
    // Verify in mock database
    const mockDb = testSetup.getDatabaseRepository();
    const storedEntities = await mockDb.getAllEntities();
    expect(storedEntities).toHaveLength(1);
  });
});
```

### Phase 4: Integration Testing with Real Database

#### 4.1 Create Integration Test Setup
Create `tests/integration/database-integration.test.ts`:
```typescript
export class IntegrationTestSetup {
  private testDbPath: string;
  private duckDbRepository: DuckDBRepository;
  
  async setup(): Promise<void> {
    // Create isolated test database
    this.testDbPath = `/tmp/test-db-${Date.now()}-${Math.random()}.db`;
    
    this.duckDbRepository = new DuckDBRepository();
    await this.duckDbRepository.initialize({ path: this.testDbPath });
    
    ServiceContainer.getInstance().setDatabaseRepository(this.duckDbRepository);
  }
  
  async teardown(): Promise<void> {
    await this.duckDbRepository.close();
    
    // Clean up test database file
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }
    
    ServiceContainer.getInstance().reset();
  }
}
```

### Phase 5: Update Application Bootstrap

#### 5.1 Update Main Application Entry
```typescript
// src/index.ts
import { DuckDBFactory } from './database/duckdb.js';
import { ServiceContainer } from './container/service-container.js';

async function bootstrap() {
  // Initialize dependency injection
  const container = ServiceContainer.getInstance();
  container.setDatabaseFactory(new DuckDBFactory());
  
  // Initialize database
  const database = container.getDatabaseRepository();
  await database.initialize();
  
  // Rest of application startup
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Create database interfaces and abstraction layer
- [ ] Implement DuckDB repository with interfaces
- [ ] Create service container and dependency injection

### Week 2: Services & Agents
- [ ] Refactor all services to use dependency injection
- [ ] Update all agents to use injected database repository
- [ ] Update API routes to use dependency injection

### Week 3: Testing Infrastructure
- [ ] Create mock database repository
- [ ] Build test utilities and setup helpers
- [ ] Implement unit test structure

### Week 4: Test Migration
- [ ] Migrate existing tests to new structure
- [ ] Create comprehensive unit tests
- [ ] Add integration tests with isolated databases

### Week 5: Validation & Optimization
- [ ] Run full test suite validation
- [ ] Performance testing with new architecture
- [ ] Documentation updates

## Benefits of This Refactoring

### 1. **Test Isolation**
- Each test runs with clean state
- No interference between tests
- Fast, reliable test execution

### 2. **Improved Maintainability**
- Clear separation of concerns
- Easy to swap database implementations
- Reduced coupling between components

### 3. **Better Testing Capabilities**
- Unit tests with mocked dependencies
- Integration tests with real database
- Predictable test behavior

### 4. **Production Stability**
- Tests cannot affect production data
- Cleaner deployment pipeline
- Better error handling and recovery

### 5. **Development Experience**
- Faster test feedback loops
- Easier debugging
- More reliable CI/CD pipeline

## Risk Mitigation

### 1. **Backward Compatibility**
- Implement interfaces gradually
- Maintain existing API contracts
- Use feature flags for rollout

### 2. **Performance**
- Benchmark before/after refactoring
- Optimize dependency injection overhead
- Monitor database connection pooling

### 3. **Testing Coverage**
- Ensure 100% test migration
- Add missing test coverage
- Validate with production scenarios

This refactoring plan addresses all identified issues while maintaining system stability and improving long-term maintainability.