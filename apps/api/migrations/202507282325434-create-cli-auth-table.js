'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('CLIAuthCodes', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: Sequelize.STRING(8),
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
    },
    status: {
      type: Sequelize.ENUM('pending', 'approved', 'expired', 'used'),
      allowNull: false,
      defaultValue: 'pending',
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    used_at: {
      type: Sequelize.DATE,
      allowNull: true,
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

  // Add indexes for performance
  await queryInterface.addIndex('CLIAuthCodes', ['code']);
  await queryInterface.addIndex('CLIAuthCodes', ['status']);
  await queryInterface.addIndex('CLIAuthCodes', ['expiresAt']);
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('CLIAuthCodes');
}; 