declare module 'duckdb' {
  export class Database {
    constructor(path: string, callback?: (err: Error | null) => void);
    close(callback?: (err: Error | null) => void): void;
    exec(sql: string, callback: (err: Error | null) => void): void;
    all<T = Record<string, unknown>>(
      sql: string, 
      callback: (err: Error | null, rows: T[]) => void
    ): void;
    all<T = Record<string, unknown>>(
      sql: string, 
      params: (string | number | boolean | null)[], 
      callback: (err: Error | null, rows: T[]) => void
    ): void;
  }

  interface DuckDBModule {
    Database: typeof Database;
  }

  const duckdb: DuckDBModule;
  export default duckdb;
} 