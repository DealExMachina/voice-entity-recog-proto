import DuckDB from 'duckdb';

// Declare process global for TypeScript
declare const process: {
  env: {
    NODE_ENV?: string;
  };
  exit: (code?: number) => never;
  argv: string[];
};

async function testDuckDbOnly(): Promise<void> {
  console.log('🧪 Testing DuckDB Only (minimal test)...');
  
  // Create a completely fresh database connection
  const uniqueId = Date.now() + Math.random().toString(36).substring(7);
  const testDbPath = `/tmp/test-db-only-${uniqueId}.db`;
  const db = new DuckDB.Database(testDbPath);
  
  try {
    console.log('✅ Created fresh DuckDB connection');
    
    // Create a simple schema
    const createTableSQL = `
      CREATE TABLE entities (
        id VARCHAR PRIMARY KEY,
        type VARCHAR NOT NULL,
        value TEXT NOT NULL,
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('🔨 Creating simple table...');
    await new Promise<void>((resolve, reject) => {
      db.exec(createTableSQL, (err) => {
        if (err) {
          console.error('❌ Failed to create table:', err.message);
          reject(new Error(`Failed to create table: ${err.message}`));
        } else {
          console.log('✅ Table created successfully');
          resolve();
        }
      });
    });
    
    // Insert a test record
    const insertSQL = `INSERT INTO entities (id, type, value, confidence) VALUES (?, ?, ?, ?)`;
    await new Promise<void>((resolve, reject) => {
      db.run(insertSQL, 'test-1', 'person', 'John Doe', 0.95, (err) => {
        if (err) {
          console.error('❌ Failed to insert:', err.message);
          reject(new Error(`Failed to insert: ${err.message}`));
        } else {
          console.log('✅ Record inserted successfully');
          resolve();
        }
      });
    });
    
    // Query the record
    const querySQL = `SELECT * FROM entities WHERE type = ?`;
    await new Promise<void>((resolve, reject) => {
      db.all(querySQL, 'person', (err, rows) => {
        if (err) {
          console.error('❌ Failed to query:', err.message);
          reject(new Error(`Failed to query: ${err.message}`));
        } else {
          console.log('✅ Query successful, found rows:', rows);
          if (rows.length === 0) {
            reject(new Error('No rows found'));
          } else {
            resolve();
          }
        }
      });
    });
    
    console.log('✅ DuckDB only test completed successfully');
    
  } finally {
    // Close the database connection
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) {
          console.error('❌ Failed to close DB:', err.message);
          reject(err);
        } else {
          console.log('🔌 Database connection closed');
          resolve();
        }
      });
    });
  }
}

async function runDuckDbOnlyTest(): Promise<void> {
  console.log('🚀 Starting DuckDB Only Test\n');
  
  try {
    await testDuckDbOnly();
    console.log('\n✅ DuckDB only test passed!');
  } catch (error) {
    console.error('\n❌ DuckDB only test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDuckDbOnlyTest();
}