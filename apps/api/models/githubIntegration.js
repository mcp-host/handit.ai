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