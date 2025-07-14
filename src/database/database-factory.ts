import type { DatabaseProvider } from '../interfaces/database.js';

// Simple singleton to manage database provider
class DatabaseFactory {
  private static instance: DatabaseFactory;
  private provider: DatabaseProvider | null = null;

  static getInstance(): DatabaseFactory {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = new DatabaseFactory();
    }
    return DatabaseFactory.instance;
  }

  setProvider(provider: DatabaseProvider): void {
    this.provider = provider;
  }

  getProvider(): DatabaseProvider {
    if (!this.provider) {
      throw new Error('Database provider not initialized. Call setProvider() first.');
    }
    return this.provider;
  }

  // For testing - reset the provider
  reset(): void {
    this.provider = null;
  }
}

export const databaseFactory = DatabaseFactory.getInstance();