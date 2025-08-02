'use strict';
import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class GitHubIntegration extends Model {
    static associate(models) {
      GitHubIntegration.belongsTo(models.Company, { foreignKey: 'companyId' });
      GitHubIntegration.hasMany(models.GitHubPullRequest, { foreignKey: 'githubIntegrationId' });
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
            refresh_token: this.refreshToken,
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

        // Update the token information
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken; // Keep existing if new one not provided
        
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
      // If token is not expired, return it as is
      if (!this.isTokenExpired()) {
        return this.accessToken;
      }

      // Token is expired, try to refresh it
      const refreshSuccess = await this.refreshAccessToken();
      
      if (refreshSuccess) {
        return this.accessToken;
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
     * Check if integration is properly configured
     */
    isConfigured() {
      return !!(
        this.accessToken &&
        this.repositoryOwner &&
        this.repositoryName &&
        this.promptFilePath &&
        this.active
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
  });

  return GitHubIntegration;
}; 