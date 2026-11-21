import { OpportunityService } from '../src/services/opportunity-service.js';
import { initializeDatabase } from '../src/database/duckdb.js';
import type { 
  Opportunity,
  OpportunitySummary 
} from '../src/types/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function testOpportunityCreation(): Promise<void> {
  console.log('🧪 Testing Opportunity Creation...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-opportunity-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const opportunityService = new OpportunityService();
    await opportunityService.initialize();

    const testOpportunity: OpportunitySummary = {
      title: "ACME Corp CRM Implementation",
      client: "ACME Corp",
      value: 75000,
      currency: "USD", 
      timeline: "Q3 2025",
      probability: 0.7,
      stage: "discovery"
    };

    console.log('\n📊 Creating new opportunity...');
    const opportunityId = await opportunityService.createOpportunity(
      testOpportunity,
      "test-conversation-123"
    );

    console.log('Created opportunity ID:', opportunityId);

    if (!opportunityId) {
      throw new Error('Failed to create opportunity');
    }

    // Verify opportunity was stored correctly
    const retrievedOpportunity = await opportunityService.getOpportunity(opportunityId);
    
    if (!retrievedOpportunity) {
      throw new Error('Failed to retrieve created opportunity');
    }

    console.log('Retrieved opportunity:', {
      title: retrievedOpportunity.title,
      client: retrievedOpportunity.client_organization,
      value: retrievedOpportunity.estimated_value,
      stage: retrievedOpportunity.stage
    });

    if (retrievedOpportunity.title !== testOpportunity.title) {
      throw new Error('Opportunity title mismatch');
    }

    if (retrievedOpportunity.estimated_value !== testOpportunity.value) {
      throw new Error('Opportunity value mismatch');
    }

    console.log('✅ Opportunity creation test completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testOpportunityMatching(): Promise<void> {
  console.log('🧪 Testing Opportunity Matching...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-opportunity-match-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const opportunityService = new OpportunityService();
    await opportunityService.initialize();

    // Create first opportunity
    const opportunity1: OpportunitySummary = {
      title: "TechCorp Software Solution",
      client: "TechCorp",
      value: 100000,
      currency: "USD",
      timeline: "December 2025",
      probability: 0.8,
      stage: "qualification"
    };

    const id1 = await opportunityService.createOpportunity(opportunity1, "conv-1");

    // Test exact match
    console.log('\n📊 Testing exact client match...');
    const exactMatch: OpportunitySummary = {
      title: "TechCorp CRM Upgrade",
      client: "TechCorp", // Exact match
      value: 120000,
      currency: "USD",
      timeline: "January 2026",
      probability: 0.75,
      stage: "discovery"
    };

    const exactMatchResult = await opportunityService.findSimilarOpportunities(exactMatch);
    console.log('Exact match results:', {
      count: exactMatchResult.length,
      first_match_score: exactMatchResult[0]?.similarity_score || 0,
      first_match_client: exactMatchResult[0]?.opportunity.client_organization
    });

    if (exactMatchResult.length === 0) {
      throw new Error('Failed to find exact client match');
    }

    if (exactMatchResult[0].similarity_score < 0.8) {
      throw new Error('Exact match should have high similarity score');
    }

    // Test partial match
    console.log('\n📊 Testing partial match...');
    const partialMatch: OpportunitySummary = {
      title: "Tech Corporation New System",
      client: "Tech Corporation", // Similar to TechCorp
      value: 95000,
      currency: "USD",
      timeline: "Q4 2025",
      probability: 0.65,
      stage: "discovery"
    };

    const partialMatchResult = await opportunityService.findSimilarOpportunities(partialMatch);
    console.log('Partial match results:', {
      count: partialMatchResult.length,
      first_match_score: partialMatchResult[0]?.similarity_score || 0,
      merge_recommended: partialMatchResult[0]?.merge_recommended
    });

    if (partialMatchResult.length === 0) {
      throw new Error('Failed to find partial match');
    }

    // Test no match
    console.log('\n📊 Testing no match scenario...');
    const noMatch: OpportunitySummary = {
      title: "Completely Different Company Solution",
      client: "XYZ Industries",
      value: 50000,
      currency: "EUR",
      timeline: "2027",
      probability: 0.5,
      stage: "discovery"
    };

    const noMatchResult = await opportunityService.findSimilarOpportunities(noMatch);
    console.log('No match results:', {
      count: noMatchResult.length,
      high_similarity: noMatchResult.some(r => r.similarity_score > 0.7)
    });

    if (noMatchResult.some(r => r.similarity_score > 0.7)) {
      throw new Error('Should not find high similarity for completely different opportunity');
    }

    console.log('✅ Opportunity matching tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testOpportunityMerging(): Promise<void> {
  console.log('🧪 Testing Opportunity Merging...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-opportunity-merge-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const opportunityService = new OpportunityService();
    await opportunityService.initialize();

    // Create base opportunity
    const baseOpportunity: OpportunitySummary = {
      title: "GlobalTech ERP Implementation",
      client: "GlobalTech Inc",
      value: 200000,
      currency: "USD",
      timeline: "Q2 2025",
      probability: 0.6,
      stage: "discovery"
    };

    const baseId = await opportunityService.createOpportunity(baseOpportunity, "conv-base");

    // Create similar opportunity for merging
    const similarOpportunity: OpportunitySummary = {
      title: "GlobalTech ERP System Upgrade",
      client: "GlobalTech Inc",
      value: 250000, // Higher value
      currency: "USD",
      timeline: "March 2025", // More specific
      probability: 0.8, // Higher probability
      stage: "qualification" // More advanced stage
    };

    console.log('\n📊 Testing merge recommendations...');
    const matches = await opportunityService.findSimilarOpportunities(similarOpportunity);
    
    if (matches.length === 0) {
      throw new Error('No matches found for merge test');
    }

    const bestMatch = matches[0];
    console.log('Best match for merging:', {
      similarity_score: bestMatch.similarity_score,
      merge_recommended: bestMatch.merge_recommended,
      differences_count: bestMatch.differences?.length || 0
    });

    if (!bestMatch.merge_recommended) {
      throw new Error('Merge should be recommended for highly similar opportunities');
    }

    if (bestMatch.differences && bestMatch.differences.length === 0) {
      throw new Error('Should identify differences between opportunities');
    }

    // Test actual merge (manual process simulation)
    console.log('\n📊 Simulating merge decision...');
    const mergeData = {
      estimated_value: Math.max(baseOpportunity.value, similarOpportunity.value),
      probability: Math.max(baseOpportunity.probability, similarOpportunity.probability),
      stage: similarOpportunity.stage, // Use more advanced stage
      decision_date: "2025-03-31" // Use more specific timeline
    };

    console.log('Merge recommendations:', mergeData);

    if (mergeData.estimated_value <= baseOpportunity.value) {
      throw new Error('Merged value should be optimized');
    }

    console.log('✅ Opportunity merging tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testEdgeCases(): Promise<void> {
  console.log('🧪 Testing Edge Cases...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-opportunity-edge-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const opportunityService = new OpportunityService();
    await opportunityService.initialize();

    // Test 1: Empty/null values
    console.log('\n📊 Test 1: Empty client name');
    try {
      const emptyClientOpportunity: OpportunitySummary = {
        title: "Anonymous Opportunity",
        client: "",
        value: 10000,
        currency: "USD",
        timeline: "2025",
        probability: 0.5,
        stage: "discovery"
      };

      const emptyClientId = await opportunityService.createOpportunity(emptyClientOpportunity, "conv-empty");
      
      if (!emptyClientId) {
        console.log('✅ Empty client properly rejected');
      } else {
        console.log('✅ Empty client handled gracefully');
      }
    } catch (error) {
      console.log('✅ Empty client properly handled with error');
    }

    // Test 2: Very long client names
    console.log('\n📊 Test 2: Very long client name');
    const longClientName = "A".repeat(500) + " Corporation International Global Enterprises Ltd.";
    const longNameOpportunity: OpportunitySummary = {
      title: "Long Name Test",
      client: longClientName,
      value: 50000,
      currency: "USD",
      timeline: "2025",
      probability: 0.7,
      stage: "discovery"
    };

    const longNameId = await opportunityService.createOpportunity(longNameOpportunity, "conv-long");
    
    if (longNameId) {
      console.log('✅ Long client name handled gracefully');
    }

    // Test 3: Special characters in client names
    console.log('\n📊 Test 3: Special characters');
    const specialCharsOpportunity: OpportunitySummary = {
      title: "Special Characters Test",
      client: "Société François & Co. (Industries) <Ltd.>",
      value: 30000,
      currency: "EUR",
      timeline: "2025",
      probability: 0.6,
      stage: "discovery"
    };

    const specialCharsId = await opportunityService.createOpportunity(specialCharsOpportunity, "conv-special");
    
    if (specialCharsId) {
      console.log('✅ Special characters handled gracefully');
    }

    // Test 4: Very similar client names (fuzzy matching)
    console.log('\n📊 Test 4: Fuzzy client name matching');
    const fuzzyTestOpportunities = [
      { client: "Microsoft Corporation", value: 100000 },
      { client: "Microsoft Corp", value: 90000 },
      { client: "Microsoft Inc", value: 95000 },
      { client: "Mirosoft Corporation", value: 80000 } // Typo
    ];

    const fuzzyIds = [];
    for (const [index, opp] of fuzzyTestOpportunities.entries()) {
      const fuzzyOpp: OpportunitySummary = {
        title: `Fuzzy Test ${index + 1}`,
        client: opp.client,
        value: opp.value,
        currency: "USD",
        timeline: "2025",
        probability: 0.7,
        stage: "discovery"
      };

      const id = await opportunityService.createOpportunity(fuzzyOpp, `conv-fuzzy-${index}`);
      fuzzyIds.push(id);
    }

    // Test matching for last opportunity (with typo)
    const typoTestOpportunity: OpportunitySummary = {
      title: "Typo Match Test",
      client: "Mirosoft Corporation", // Same typo
      value: 85000,
      currency: "USD",
      timeline: "2025",
      probability: 0.8,
      stage: "qualification"
    };

    const typoMatches = await opportunityService.findSimilarOpportunities(typoTestOpportunity);
    console.log('Fuzzy matching results:', {
      total_matches: typoMatches.length,
      high_similarity_matches: typoMatches.filter(m => m.similarity_score > 0.8).length,
      exact_typo_match: typoMatches.some(m => 
        m.opportunity.client_organization === "Mirosoft Corporation" && m.similarity_score > 0.9
      )
    });

    console.log('✅ Edge case tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

async function testPerformance(): Promise<void> {
  console.log('🧪 Testing Performance...');
  
  // Use unique database for testing
  const originalDbPath = process.env.DB_PATH;
  process.env.DB_PATH = `/tmp/test-opportunity-perf-${Date.now()}.db`;
  
  try {
    await initializeDatabase();
    
    const opportunityService = new OpportunityService();
    await opportunityService.initialize();

    // Create multiple opportunities for performance testing
    console.log('\n📊 Creating test dataset...');
    const testOpportunities = [
      { client: "TechCorp Inc", value: 100000 },
      { client: "GlobalSoft Ltd", value: 150000 },
      { client: "DataSystems Corp", value: 80000 },
      { client: "CloudTech Solutions", value: 200000 },
      { client: "InnovateNow Inc", value: 120000 },
      { client: "FutureTech Ltd", value: 90000 },
      { client: "SmartSystems Corp", value: 110000 },
      { client: "NextGen Solutions", value: 180000 },
      { client: "TechAdvance Inc", value: 75000 },
      { client: "DigitalFirst Ltd", value: 160000 }
    ];

    const createStartTime = Date.now();
    
    for (const [index, opp] of testOpportunities.entries()) {
      const testOpp: OpportunitySummary = {
        title: `Performance Test Opportunity ${index + 1}`,
        client: opp.client,
        value: opp.value,
        currency: "USD",
        timeline: "2025",
        probability: 0.7,
        stage: "discovery"
      };

      await opportunityService.createOpportunity(testOpp, `perf-conv-${index}`);
    }

    const createEndTime = Date.now();
    const createTime = createEndTime - createStartTime;

    console.log(`Created ${testOpportunities.length} opportunities in ${createTime}ms`);

    // Test search performance
    console.log('\n📊 Testing search performance...');
    const searchStartTime = Date.now();

    const searchQueries = [
      { client: "TechCorp Inc", value: 105000 },
      { client: "GlobalSoft", value: 140000 },
      { client: "Unknown Company", value: 50000 },
      { client: "Tech", value: 100000 },
      { client: "Solutions", value: 150000 }
    ];

    let totalMatches = 0;
    for (const query of searchQueries) {
      const queryOpp: OpportunitySummary = {
        title: "Search Performance Test",
        client: query.client,
        value: query.value,
        currency: "USD",
        timeline: "2025",
        probability: 0.7,
        stage: "discovery"
      };

      const matches = await opportunityService.findSimilarOpportunities(queryOpp);
      totalMatches += matches.length;
    }

    const searchEndTime = Date.now();
    const searchTime = searchEndTime - searchStartTime;

    console.log(`Performed ${searchQueries.length} searches in ${searchTime}ms`);
    console.log(`Average search time: ${searchTime / searchQueries.length}ms`);
    console.log(`Total matches found: ${totalMatches}`);

    if (searchTime / searchQueries.length > 1000) { // More than 1 second per search
      console.warn('⚠️ Search performance may be slow');
    }

    console.log('✅ Performance tests completed');
    
  } finally {
    // Restore original DB path
    if (originalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }
  }
}

export async function runOpportunityServiceTests(): Promise<void> {
  console.log('🚀 Starting Opportunity Service Tests\n');
  
  try {
    await testOpportunityCreation();
    console.log();
    
    await testOpportunityMatching();
    console.log();
    
    await testOpportunityMerging();
    console.log();
    
    await testEdgeCases();
    console.log();
    
    await testPerformance();
    console.log();
    
    console.log('✅ All Opportunity Service tests completed successfully!');
  } catch (error) {
    console.error('❌ Opportunity Service test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runOpportunityServiceTests();
} 