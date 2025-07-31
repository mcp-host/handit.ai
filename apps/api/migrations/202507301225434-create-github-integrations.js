'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('GitHubIntegrations', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      field: 'company_id',
    },
    github_app_installation_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'github_app_installation_id',
    },
    access_token: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'access_token',
    },
    refresh_token: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'refresh_token',
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    repository_owner: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'repository_owner',
    },
    repository_name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'repository_name',
    },
    branch_name: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: 'main',
      field: 'branch_name',
    },
    prompt_file_path: {
      type: Sequelize.STRING(500),
      allowNull: false,
      field: 'prompt_file_path',
    },
    active: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  });

  // Add indexes
  await queryInterface.addIndex('GitHubIntegrations', ['company_id']);
  await queryInterface.addIndex('GitHubIntegrations', ['repository_owner', 'repository_name']);
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('GitHubIntegrations');
}; 