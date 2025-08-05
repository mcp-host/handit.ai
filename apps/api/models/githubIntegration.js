'use strict';
import { Model } from 'sequelize';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export default (sequelize, DataTypes) => {
  class GitHubIntegration extends Model {
    static associate(models) {
      GitHubIntegration.belongsTo(models.Company, { foreignKey: 'companyId' });
      GitHubIntegration.hasMany(models.GitHubPullRequest, { foreignKey: 'githubIntegrationId' });
    }

    /**
     * Encrypt a token using AES-256-CBC
     * @param {string} token - The token to encrypt
     * @returns {string} Encrypted token in format: iv:encryptedData
     */
    static encryptToken(token) {
      if (!token) return token;
      
      const secretKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
      if (!secretKey) {
        console.warn('GITHUB_TOKEN_ENCRYPTION_KEY not set, storing tokens in plain text');
        return token;
      }

      try {
        // Create a 32-byte key from the secret
        const key = crypto.scryptSync(secretKey, 'github-salt', 32);
        
        // Generate a random IV
        const iv = crypto.randomBytes(16);
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        // Encrypt the token
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Return format: iv:encryptedData
        return `${iv.toString('hex')}:${encrypted}`;
      } catch (error) {
        console.error('Error encrypting GitHub token:', error);
        return token; // Return original token if encryption fails
      }
    }

    /**
     * Decrypt a token using AES-256-CBC
     * @param {string} encryptedToken - The encrypted token
     * @returns {string} Decrypted token
     */
    static decryptToken(encryptedToken) {
      if (!encryptedToken) return encryptedToken;
      
      const secretKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
      if (!secretKey) {
        return encryptedToken; // Return as-is if no encryption key
      }

      // Check if token is encrypted (contains colons)
      if (!encryptedToken.includes(':')) {
        return encryptedToken; // Not encrypted, return as-is
      }

      try {
        // Parse the encrypted token format: iv:encryptedData
        const [ivHex, encrypted] = encryptedToken.split(':');
        
        if (!ivHex || !encrypted) {
          console.warn('Invalid encrypted token format');
          return encryptedToken;
        }
        
        // Create a 32-byte key from the secret
        const key = crypto.scryptSync(secretKey, 'github-salt', 32);
        
        // Convert hex string back to buffer
        const iv = Buffer.from(ivHex, 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        // Decrypt the token
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } catch (error) {
        console.error('Error decrypting GitHub token:', error);
        return encryptedToken; // Return encrypted token if decryption fails
      }
    }

    /**
     * Check if the access token is expired
     */
    isTokenExpired() {
      if (!this.expiresAt) return false;
      return new Date() > this.expiresAt;
    }

    /**
     * Refresh the access token using the refresh token
     * @returns {Promise<boolean>} True if refresh was successful, false otherwise
     */
    async refreshAccessToken() {
      if (!this.refreshToken) {
        console.error('No refresh token available for GitHub integration');
        return false;
      }

      try {
        console.log('Refreshing GitHub access token...');
        
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            refresh_token: GitHubIntegration.decryptToken(this.refreshToken),
            grant_type: 'refresh_token',
          }),
        });

        if (!response.ok) {
          console.error('Failed to refresh GitHub token:', response.status, response.statusText);
          return false;
        }

        const data = await response.json();

        if (data.error) {
          console.error('GitHub token refresh error:', data.error_description || data.error);
          return false;
        }

        // Update the token information (encrypt before storing)
        this.accessToken = GitHubIntegration.encryptToken(data.access_token);
        this.refreshToken = data.refresh_token ? GitHubIntegration.encryptToken(data.refresh_token) : this.refreshToken; // Keep existing if new one not provided
        
        // Set expiration time (GitHub tokens typically expire in 8 hours)
        if (data.expires_in) {
          this.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        } else {
          // Default to 8 hours if not specified
          this.expiresAt = new Date(Date.now() + (8 * 60 * 60 * 1000));
        }

        // Save the updated token information
        await this.save();

        console.log('GitHub access token refreshed successfully');
        return true;

      } catch (error) {
        console.error('Error refreshing GitHub access token:', error);
        return false;
      }
    }

    /**
     * Get a valid access token, refreshing it if necessary
     * @returns {Promise<string|null>} Valid access token or null if refresh failed
     */
    async getValidAccessToken() {
      // If token is not expired, return decrypted token
      if (!this.isTokenExpired()) {
        return GitHubIntegration.decryptToken(this.accessToken);
      }

      // Token is expired, try to refresh it
      const refreshSuccess = await this.refreshAccessToken();
      
      if (refreshSuccess) {
        return GitHubIntegration.decryptToken(this.accessToken);
      }

      console.error('Unable to get valid access token for GitHub integration');
      return null;
    }

    /**
     * Get repository full name
     */
    getRepositoryFullName() {
      return `${this.repositoryOwner}/${this.repositoryName}`;
    }

    /**
     * Generate a JWT token for GitHub App authentication
     * @returns {string} JWT token for GitHub App
     */
    static generateJWT() {
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
      
      if (!appId || !privateKey) {
        throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables are required');
      }

      // Format the private key (handle both raw and base64 encoded keys)
      let formattedPrivateKey = privateKey;
      if (!privateKey.includes('-----BEGIN')) {
        // If it's base64 encoded, decode it
        formattedPrivateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      }

      // JWT payload
      const payload = {
        iat: Math.floor(Date.now() / 1000) - 60, // Issued at time (60 seconds ago to account for clock skew)
        exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expires in 10 minutes
        iss: parseInt(appId) // GitHub App ID
      };

      // Generate JWT
      return jwt.sign(payload, formattedPrivateKey, { algorithm: 'RS256' });
    }

    /**
     * Create an installation access token using JWT
     * @param {number} installationId - The GitHub App installation ID
     * @param {Object} options - Optional parameters
     * @param {Array<string>} options.repositories - Specific repositories to grant access to
     * @param {Object} options.permissions - Specific permissions to grant
     * @returns {Promise<Object>} Installation access token response
     */
    static async createInstallationAccessToken(installationId, options = {}) {
      const jwtToken = this.generateJWT();
      
      const requestBody = {};
      if (options.repositories) {
        requestBody.repositories = options.repositories;
      }
      if (options.permissions) {
        requestBody.permissions = options.permissions;
      }

      try {
        const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${jwtToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'handit-ai/1.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to create installation access token: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const tokenData = await response.json();
        
        console.log('✅ Successfully created installation access token');
        console.log(`   - Token expires at: ${tokenData.expires_at}`);
        console.log(`   - Permissions: ${JSON.stringify(tokenData.permissions)}`);
        
        return tokenData;
      } catch (error) {
        console.error('❌ Error creating installation access token:', error);
        throw error;
      }
    }

    /**
     * Get a valid installation access token for this integration
     * @returns {Promise<string|null>} Valid installation access token or null if failed
     */
    async getInstallationAccessToken(repositories = null) {
      if (!this.githubAppInstallationId) {
        console.error('No GitHub App installation ID found for this integration');
        return null;
      }

      try {
        // Create installation access token with repository-specific access
        const tokenResponse = await GitHubIntegration.createInstallationAccessToken(
          this.githubAppInstallationId,
          {
            permissions: {
              contents: 'write',     // Read and write repository contents
              pull_requests: 'write', // Create and manage pull requests
              metadata: 'read',      // Read repository metadata
              issues: 'write',       // Create issues and comments (for PR comments)
            }
          }
        );

        return tokenResponse.token;
      } catch (error) {
        console.error('Failed to get installation access token:', error);
        return null;
      }
    }

    /**
     * Check if integration is properly configured
     */
    isConfigured() {
      return !!(
        this.githubAppInstallationId &&
        this.repositoryOwner
      );
    }
  }

  GitHubIntegration.init({
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'company_id',
    },
    githubAppInstallationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'github_app_installation_id',
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token',
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    repositoryOwner: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'repository_owner',
    },
    repositoryName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'repository_name',
    },
    branchName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'main',
      field: 'branch_name',
    },
    promptFilePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'prompt_file_path',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  }, {
    sequelize,
    modelName: 'GitHubIntegration',
    tableName: 'GitHubIntegrations',
    timestamps: true,
    hooks: {
      /**
       * Encrypt tokens before creating a new record
       */
      beforeCreate: (instance) => {
        if (instance.accessToken) {
          instance.accessToken = GitHubIntegration.encryptToken(instance.accessToken);
        }
        if (instance.refreshToken) {
          instance.refreshToken = GitHubIntegration.encryptToken(instance.refreshToken);
        }
      },
      
      /**
       * Encrypt tokens before updating a record
       */
      beforeUpdate: (instance) => {
        if (instance.changed('accessToken') && instance.accessToken) {
          instance.accessToken = GitHubIntegration.encryptToken(instance.accessToken);
        }
        if (instance.changed('refreshToken') && instance.refreshToken) {
          instance.refreshToken = GitHubIntegration.encryptToken(instance.refreshToken);
        }
      }
    }
  });

  return GitHubIntegration;
}; 