'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('GitHubPullRequests', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    github_integration_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'GitHubIntegrations',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      field: 'github_integration_id',
    },
    model_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Models',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      field: 'model_id',
    },
    pr_number: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'pr_number',
    },
    pr_url: {
      type: Sequelize.STRING(500),
      allowNull: false,
      field: 'pr_url',
    },
    old_prompt: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'old_prompt',
    },
    new_prompt: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'new_prompt',
    },
    metrics_improvement: {
      type: Sequelize.JSONB,
      allowNull: true,
      field: 'metrics_improvement',
    },
    status: {
      type: Sequelize.ENUM('open', 'merged', 'closed'),
      allowNull: false,
      defaultValue: 'open',
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
  await queryInterface.addIndex('GitHubPullRequests', ['github_integration_id']);
  await queryInterface.addIndex('GitHubPullRequests', ['model_id']);
  await queryInterface.addIndex('GitHubPullRequests', ['status']);
  await queryInterface.addIndex('GitHubPullRequests', ['pr_number']);
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('GitHubPullRequests');
}; 