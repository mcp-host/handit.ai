#!/usr/bin/env node

/**
 * Test script for GitHub OAuth backend implementation
 * Run with: node src/test-github-oauth.js
 */

import dotenv from 'dotenv';
import GitHubOAuthService from './services/githubOAuthService.js';

dotenv.config();

async function testGitHubOAuthService() {
  console.log('🧪 Testing GitHub OAuth Service...\n');

  // Test 1: Check environment variables
  console.log('1. Checking environment variables...');
  const requiredEnvVars = [
    'GITHUB_OAUTH_CLIENT_ID',
    'GITHUB_OAUTH_CLIENT_SECRET',
    'GITHUB_APP_ID',
    'JWT_SECRET',
  ];

  let envVarsOk = true;
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(`❌ Missing: ${envVar}`);
      envVarsOk = false;
    } else {
      console.log(`✅ Found: ${envVar}`);
    }
  }

  if (!envVarsOk) {
    console.log('\n❌ Some environment variables are missing. Please set them in your .env file.');
    console.log('\nRequired variables:');
    console.log('- GITHUB_OAUTH_CLIENT_ID: Your GitHub OAuth App Client ID');
    console.log('- GITHUB_OAUTH_CLIENT_SECRET: Your GitHub OAuth App Client Secret');
    console.log('- GITHUB_APP_ID: Your existing GitHub App ID');
    console.log('- JWT_SECRET: Your JWT secret key');
    return;
  }

  console.log('\n✅ All required environment variables are set!\n');

  // Test 2: Test OAuth URL generation
  console.log('2. Testing OAuth URL generation...');
  try {
    const oauthUrl = new URL('https://github.com/login/oauth/authorize');
    oauthUrl.searchParams.set('client_id', process.env.GITHUB_OAUTH_CLIENT_ID);
    oauthUrl.searchParams.set('redirect_uri', process.env.GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/github/callback');
    oauthUrl.searchParams.set('scope', 'read:org user:email read:user');
    oauthUrl.searchParams.set('state', 'test-state');
    
    console.log('✅ OAuth URL generated successfully:');
    console.log(`   ${oauthUrl.toString()}\n`);
  } catch (error) {
    console.log(`❌ Error generating OAuth URL: ${error.message}\n`);
  }

  // Test 3: Test JWT token generation
  console.log('3. Testing JWT token generation...');
  try {
    const testUser = { id: 123 };
    const token = GitHubOAuthService.generateUserToken(testUser);
    console.log('✅ JWT token generated successfully');
    console.log(`   Token length: ${token.length} characters\n`);
  } catch (error) {
    console.log(`❌ Error generating JWT token: ${error.message}\n`);
  }

  // Test 4: Test GitHub App JWT generation
  console.log('4. Testing GitHub App JWT generation...');
  try {
    const jwt = GitHubIntegration.generateJWT();
    console.log('✅ GitHub App JWT generated successfully');
    console.log(`   JWT length: ${jwt.length} characters\n`);
  } catch (error) {
    console.log(`❌ Error generating GitHub App JWT: ${error.message}\n`);
  }

  console.log('🎉 GitHub OAuth backend implementation test completed!');
  console.log('\nNext steps:');
  console.log('1. Set up a GitHub OAuth App in your GitHub settings');
  console.log('2. Configure the callback URL in your OAuth App');
  console.log('3. Run the migration to add GitHub OAuth fields to User model');
  console.log('4. Test the OAuth flow with a real GitHub account');
}

// Import GitHubIntegration for the test
import db from './models/index.js';
const { GitHubIntegration } = db;

testGitHubOAuthService().catch(console.error);
