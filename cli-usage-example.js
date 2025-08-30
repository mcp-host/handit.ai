/**
 * CLI Authentication Usage Example
 * 
 * This file demonstrates how the CLI authentication system would work
 * in a real CLI application.
 */

import CLIAuthClient from './cli-auth-client.js';

// Example CLI command implementation
async function loginCommand() {
  const client = new CLIAuthClient();
  
  try {
    
    // For this example, we'll use a simple approach
    // In a real CLI, you might prompt for email/password or use environment variables
    const userId = process.env.HANDIT_USER_ID;
    const companyId = process.env.HANDIT_COMPANY_ID;
    
    if (!userId || !companyId) {
      process.exit(1);
    }
    
    // Complete authentication flow
    const result = await client.authenticate(userId, companyId);
    
    return result;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }
}

// Example of using authenticated requests
async function listModelsCommand() {
  const client = new CLIAuthClient();
  
  try {
    // This will automatically use stored tokens
    const models = await client.makeRequest('/api/models');
    
    console.log('📋 Your Models:');
    models.forEach(model => {
      console.log(`  - ${model.name} (${model.problemType})`);
    });
  } catch (error) {
    console.error('❌ Failed to fetch models:', error.message);
    process.exit(1);
  }
}

// Example of executing LLM calls
async function executeLLMCommand(prompt, model = 'gpt-4o', provider = 'OpenAI') {
  const client = new CLIAuthClient();
  
  try {
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    console.log(`🤖 Executing LLM call with ${provider} (${model})...`);
    
    const result = await client.executeLLM(messages, model, provider);
    
    console.log('📝 Response:');
    console.log(result.text);
    
    if (result.usage) {
      console.log('\n📊 Usage:');
      console.log(`  - Prompt tokens: ${result.usage.prompt_tokens || 'N/A'}`);
      console.log(`  - Completion tokens: ${result.usage.completion_tokens || 'N/A'}`);
      console.log(`  - Total tokens: ${result.usage.total_tokens || 'N/A'}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Failed to execute LLM call:', error.message);
    process.exit(1);
  }
}

// Example CLI structure
const cli = {
  login: loginCommand,
  models: {
    list: listModelsCommand,
  },
  llm: executeLLMCommand,
  logout: () => {
    const client = new CLIAuthClient();
    client.logout();
    console.log('👋 Logged out successfully');
  },
};

// Usage examples:
// 
// 1. Login (with environment variables):
//    export HANDIT_USER_ID=123
//    export HANDIT_COMPANY_ID=456
//    handit login
//
// 2. Or use dashboard to generate code manually:
//    Visit: https://dashboard.handit.ai/cli-auth
//    Sign in and generate code
//    Use code in CLI
//
// 3. List models:
//    handit models list
//
// 4. Execute LLM calls:
//    handit llm "Hello, how are you?" gpt-4o OpenAI
//    handit llm "Explain quantum computing" meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 TogetherAI
//    handit llm "Write a poem" gemini-1.5-flash GoogleAI
//
// 5. Logout:
//    handit logout

export default cli; 