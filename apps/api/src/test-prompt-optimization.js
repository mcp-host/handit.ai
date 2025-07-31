/**
 * Test script for prompt optimization PR service
 * This script demonstrates how the prompt optimization service works
 */

import { createPromptOptimizationPR } from './services/promptOptimizationPRService.js';

// Mock agent data for testing
const mockAgent = {
  id: 1,
  name: 'Test Agent',
  repository: 'https://github.com/testuser/test-repo',
  companyId: 1
};

// Mock models (you would use actual Sequelize models in production)
const mockModels = {
  Company: {
    findByPk: async (id) => ({ id, name: 'Test Company' })
  },
  GitHubIntegration: {
    findOne: async () => ({
      id: 1,
      companyId: 1,
      accessToken: 'mock_token',
      active: true,
      isTokenExpired: () => false
    })
  },
  GitHubPullRequest: {
    create: async (data) => ({ id: 1, ...data })
  }
};

const originalPrompt = `You are a helpful assistant that answers questions about products.
Please provide accurate and detailed information.
Always be polite and professional.`;

const optimizedPrompt = `You are an expert product consultant with deep knowledge of our catalog.
Your goal is to provide comprehensive, accurate product information that helps customers make informed decisions.

Guidelines:
- Always be professional, friendly, and helpful
- Provide specific details about features, benefits, and use cases
- If you don't know something, say so clearly
- Ask clarifying questions when needed to better assist the customer`;

const metrics = {
  accuracy: 0.92,
  improvement: 0.18,
  totalEvaluations: 150,
  successfulEvaluations: 138,
  timestamp: new Date().toISOString()
};

async function testPromptOptimization() {
  console.log('🧪 Testing Prompt Optimization PR Service\n');
  
  try {
    const result = await createPromptOptimizationPR({
      agent: mockAgent,
      originalPrompt,
      optimizedPrompt,
      metrics,
      models: mockModels
    });

    console.log('📊 Test Results:');
    console.log('================');
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log(`PR Number: ${result.prNumber}`);
      console.log(`PR URL: ${result.prUrl}`);
      console.log(`Branch: ${result.branchName}`);
      console.log(`Files Changed: ${result.filesChanged}`);
      console.log(`Locations Found: ${result.locationsFound}`);
    } else {
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPromptOptimization();
}

export { testPromptOptimization };