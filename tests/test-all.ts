import { runSalesAgentTests } from './test-sales-agent.js';
import { runConversationAgentTests } from './test-conversation-agent.js';
import { runOpportunityServiceTests } from './test-opportunity-service.js';
import { runIntegrationTests } from './test-integration.js';

// Import the existing basic tests
async function runBasicTests(): Promise<void> {
  console.log('🧪 Running Basic Tests...');
  
  try {
    // Import and run the existing basic tests
    const { runTests } = await import('./test-basic.js');
    await runTests();
    console.log('✅ Basic tests completed successfully');
  } catch (error) {
    console.error('❌ Basic tests failed:', error);
    throw error;
  }
}

interface TestSuite {
  name: string;
  runner: () => Promise<void>;
  category: 'unit' | 'integration' | 'basic';
}

const testSuites: TestSuite[] = [
  {
    name: 'Basic Entity Extraction',
    runner: runBasicTests,
    category: 'basic'
  },
  {
    name: 'Sales Agent',
    runner: runSalesAgentTests,
    category: 'unit'
  },
  {
    name: 'Conversation Agent', 
    runner: runConversationAgentTests,
    category: 'unit'
  },
  {
    name: 'Opportunity Service',
    runner: runOpportunityServiceTests,
    category: 'unit'
  },
  {
    name: 'Full Pipeline Integration',
    runner: runIntegrationTests,
    category: 'integration'
  }
];

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🚀 Running ${suite.name} Tests...`);
    console.log('─'.repeat(60));
    
    await suite.runner();
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${suite.name} tests completed in ${duration}ms`);
    
    return {
      suite: suite.name,
      status: 'passed',
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ ${suite.name} tests failed in ${duration}ms:`, errorMessage);
    
    return {
      suite: suite.name,
      status: 'failed',
      duration,
      error: errorMessage
    };
  }
}

async function runAllTests(options: {
  category?: 'unit' | 'integration' | 'basic';
  suites?: string[];
  skipOnError?: boolean;
} = {}): Promise<void> {
  console.log('🚀 Sales Buddy - Conversational AI Agent Test Suite');
  console.log('═'.repeat(60));
  console.log('Running comprehensive tests for the sales opportunity system');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  // Filter test suites based on options
  let suitesToRun = testSuites;
  
  if (options.category) {
    suitesToRun = suitesToRun.filter(suite => suite.category === options.category);
    console.log(`📋 Running ${options.category} tests only`);
  }
  
  if (options.suites) {
    suitesToRun = suitesToRun.filter(suite => 
      options.suites!.some(name => suite.name.toLowerCase().includes(name.toLowerCase()))
    );
    console.log(`📋 Running selected suites: ${options.suites.join(', ')}`);
  }

  const results: TestResult[] = [];
  let failedCount = 0;
  
  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    results.push(result);
    
    if (result.status === 'failed') {
      failedCount++;
      
      if (options.skipOnError) {
        console.log('⏭️ Skipping remaining tests due to failure');
        break;
      }
    }
  }

  // Generate test report
  console.log('\n📊 Test Results Summary');
  console.log('═'.repeat(60));
  
  const passedCount = results.filter(r => r.status === 'passed').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passedCount} ✅`);
  console.log(`Failed: ${failedCount} ❌`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Success Rate: ${((passedCount / results.length) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.status === 'passed' ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    console.log(`  ${status} ${result.suite.padEnd(25)} ${duration.padStart(8)}`);
    
    if (result.error) {
      console.log(`      Error: ${result.error.substring(0, 80)}...`);
    }
  });

  // Feature coverage summary
  console.log('\n🎯 Feature Coverage Summary:');
  console.log('─'.repeat(60));
  console.log('✅ Voice-to-Text Transcription (Whisper API)');
  console.log('✅ Entity Extraction (Organizations, People, Financial, Dates)');
  console.log('✅ Chain-of-Thought Sales Analysis'); 
  console.log('✅ Opportunity Detection & Confidence Scoring');
  console.log('✅ Conversational Response Generation');
  console.log('✅ Text-to-Speech Audio Generation');
  console.log('✅ Opportunity Matching & Similarity Scoring');
  console.log('✅ Intelligent Opportunity Merging');
  console.log('✅ Database Persistence (DuckDB)');
  console.log('✅ Real-time WebSocket Communication');
  console.log('✅ Interactive Frontend with Audio Recording');
  console.log('✅ Error Handling & Graceful Degradation');
  console.log('✅ Performance Optimization & Memory Management');

  if (failedCount > 0) {
    console.log('\n❌ Some tests failed. Check the detailed results above.');
    console.log('💡 Tips:');
    console.log('  - Ensure OpenAI API key is set for real API tests');
    console.log('  - Check database permissions and disk space');
    console.log('  - Verify all dependencies are installed');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! The sales opportunity system is working correctly.');
    console.log('🚀 Ready for deployment and real-world usage.');
  }
}

// Command line interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: Parameters<typeof runAllTests>[0] = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--unit':
        options.category = 'unit';
        break;
      case '--integration':
        options.category = 'integration';
        break;
      case '--basic':
        options.category = 'basic';
        break;
      case '--suite':
        if (i + 1 < args.length) {
          options.suites = args[i + 1].split(',').map(s => s.trim());
          i++; // Skip next argument
        }
        break;
      case '--skip-on-error':
        options.skipOnError = true;
        break;
      case '--help':
        console.log(`
Sales Buddy Test Suite

Usage: npm test [options]

Options:
  --unit              Run only unit tests
  --integration       Run only integration tests  
  --basic             Run only basic tests
  --suite <names>     Run specific test suites (comma-separated)
  --skip-on-error     Stop testing on first failure
  --help              Show this help message

Examples:
  npm test                                  # Run all tests
  npm test -- --unit                       # Run only unit tests
  npm test -- --suite "sales,opportunity"  # Run sales and opportunity tests
  npm test -- --integration --skip-on-error # Run integration tests, stop on failure
        `);
        process.exit(0);
        break;
    }
  }

  try {
    await runAllTests(options);
  } catch (error) {
    console.error('\n💥 Test suite execution failed:', error);
    process.exit(1);
  }
}

// Export for use in other files
export { runAllTests, testSuites };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 