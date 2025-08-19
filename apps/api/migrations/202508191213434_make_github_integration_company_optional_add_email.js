'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.changeColumn('GitHubIntegrations', 'company_id', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  // Add optional email column
  await queryInterface.addColumn('GitHubIntegrations', 'email', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('GitHubIntegrations', 'email');

    // Make company_id NOT NULL again
    await queryInterface.changeColumn('GitHubIntegrations', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
};
