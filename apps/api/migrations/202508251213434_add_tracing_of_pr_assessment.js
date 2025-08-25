'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('GitHubPullRequests', 'type', {
    type: Sequelize.STRING(255),
    allowNull: true,
    defaultValue: 'prompt_optimization',
  });

  await queryInterface.addColumn('GitHubPullRequests', 'assessment_result', {
    type: Sequelize.TEXT,
    allowNull: true
  });

  await queryInterface.changeColumn('GitHubPullRequests', 'model_id', {
    type: Sequelize.INTEGER,
    allowNull: true
  });

  await queryInterface.changeColumn('GitHubPullRequests', 'old_prompt', {
    type: Sequelize.TEXT,
    allowNull: true
  });

  await queryInterface.changeColumn('GitHubPullRequests', 'new_prompt', {
    type: Sequelize.TEXT,
    allowNull: true
  });

  await queryInterface.changeColumn('GitHubPullRequests', 'metrics_improvement', {
    type: Sequelize.JSON,
    allowNull: true
  });

  await queryInterface.changeColumn('GitHubPullRequests', 'status', {
    type: Sequelize.ENUM('open', 'merged', 'closed'),
    allowNull: false,
    defaultValue: 'open',
  });
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('GitHubPullRequests', 'type');
  await queryInterface.removeColumn('GitHubPullRequests', 'assessment_result');
  await queryInterface.changeColumn('GitHubPullRequests', 'model_id', {
    type: Sequelize.INTEGER,
    allowNull: false
  });
  await queryInterface.changeColumn('GitHubPullRequests', 'old_prompt', {
    type: Sequelize.TEXT,
    allowNull: false
  });
  await queryInterface.changeColumn('GitHubPullRequests', 'new_prompt', {
    type: Sequelize.TEXT,
    allowNull: false
  });
  await queryInterface.changeColumn('GitHubPullRequests', 'metrics_improvement', {
    type: Sequelize.JSON,
    allowNull: false
  });
  await queryInterface.changeColumn('GitHubPullRequests', 'status', {
    type: Sequelize.ENUM('open', 'merged', 'closed'),
    allowNull: false
  });
};
