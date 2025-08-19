/* eslint-disable */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make company_id nullable
    await queryInterface.changeColumn('GitHubIntegrations', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Add optional email column
    await queryInterface.addColumn('GitHubIntegrations', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove email column
    await queryInterface.removeColumn('GitHubIntegrations', 'email');

    // Make company_id NOT NULL again
    await queryInterface.changeColumn('GitHubIntegrations', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};


