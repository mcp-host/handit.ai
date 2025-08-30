/**
 * CLI Authentication Client
 * 
 * This module provides a client for authenticating with the handit CLI system.
 * It handles the device authorization flow and token management.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

class CLIAuthClient {
  constructor(baseUrl = 'https://dashboard.handit.ai') {
    this.baseUrl = baseUrl;
    this.configDir = path.join(os.homedir(), '.handit');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  /**
   * Ensure config directory exists
   */
  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return null;
  }

  /**
   * Save configuration to file
   */
  saveConfig(config) {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  /**
   * Clear stored configuration
   */
  logout() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Generate a new CLI authentication code
   */
  async generateCode(userId, companyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/cli/auth/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, companyId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate code');
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating code:', error);
      throw error;
    }
  }

  /**
   * Check the status of a CLI authentication code
   */
  async checkStatus(code) {
    try {
      const response = await fetch(`${this.baseUrl}/api/cli/auth/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking status:', error);
      throw error;
    }
  }

  /**
   * Complete authentication with code
   */
  async completeAuthentication(code) {
    try {
      const result = await this.checkStatus(code);
      
      if (result.status === 'success') {
        return result;
      }
      
      throw new Error('Authentication failed');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Complete the authentication flow
   */
  async authenticate(userId, companyId) {
    try {
      // Generate authentication code
      const { code, expiresAt } = await this.generateCode(userId, companyId);
      
      // Complete authentication immediately
      const result = await this.completeAuthentication(code);
      
      // Save tokens
      const config = {
        authToken: result.authToken,
        apiToken: result.apiToken,
        stagingApiToken: result.stagingApiToken,
        user: result.user,
        company: result.company,
        authenticatedAt: new Date().toISOString(),
      };
      
      this.saveConfig(config);
      
      
      return config;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current authentication status
   */
  isAuthenticated() {
    const config = this.loadConfig();
    return config && config.authToken && config.apiToken;
  }

  /**
   * Get stored tokens
   */
  getTokens() {
    const config = this.loadConfig();
    if (!config) {
      throw new Error('Not authenticated. Please run "handit login" first.');
    }
    return {
      authToken: config.authToken,
      apiToken: config.apiToken,
      stagingApiToken: config.stagingApiToken,
    };
  }

  /**
   * Make an authenticated API request
   */
  async makeRequest(endpoint, options = {}) {
    const tokens = this.getTokens();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.authToken}`,
      'X-Integration-Token': tokens.apiToken,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Authentication expired. Please run "handit login" again.');
        this.logout();
        process.exit(1);
      }
      
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute LLM call using system environment variables
   */
  async executeLLM(messages, model, provider = 'OpenAI') {
    try {
      const response = await fetch(`${this.baseUrl}/api/cli/auth/llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model,
          provider,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute LLM call');
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      console.error('Error executing LLM:', error);
      throw error;
    }
  }
}

export default CLIAuthClient; 