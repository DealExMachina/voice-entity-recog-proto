import { MockDatabaseProvider } from '../../src/database/mock-provider.js';
import { databaseFactory } from '../../src/database/database-factory.js';

export class TestSetup {
  private mockDatabase: MockDatabaseProvider;

  constructor() {
    this.mockDatabase = new MockDatabaseProvider();
  }

  async setup(): Promise<void> {
    // Initialize mock database
    await this.mockDatabase.initialize();
    
    // Set the mock as the database provider
    databaseFactory.setProvider(this.mockDatabase);
    
    console.log('🧪 Test environment setup complete');
  }

  async teardown(): Promise<void> {
    // Reset the mock database
    this.mockDatabase.reset();
    await this.mockDatabase.close();
    
    // Reset the factory
    databaseFactory.reset();
    
    console.log('🧪 Test environment cleaned up');
  }

  getMockDatabase(): MockDatabaseProvider {
    return this.mockDatabase;
  }
}