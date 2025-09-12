'use strict';

export const up = async (queryInterface, Sequelize) => {
  // Add github_user_id column
  await queryInterface.addColumn('Users', 'github_user_id', {
    type: Sequelize.STRING,
    allowNull: true,
    unique: true,
  });

  // Add github_username column
  await queryInterface.addColumn('Users', 'github_username', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  // Add oauth_provider column
  await queryInterface.addColumn('Users', 'oauth_provider', {
    type: Sequelize.ENUM('github', 'google', 'microsoft'),
    allowNull: true,
    defaultValue: null,
  });

  console.log('Added GitHub OAuth fields to Users table');
};

export const down = async (queryInterface, Sequelize) => {
  // Remove oauth_provider column
  await queryInterface.removeColumn('Users', 'oauth_provider');

  // Remove github_username column
  await queryInterface.removeColumn('Users', 'github_username');

  // Remove github_user_id column
  await queryInterface.removeColumn('Users', 'github_user_id');

  console.log('Removed GitHub OAuth fields from Users table');
};
