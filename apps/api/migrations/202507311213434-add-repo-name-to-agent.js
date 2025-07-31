'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('Agents', 'repository', {
    type: Sequelize.STRING,
    allowNull: true,
    field: 'repository'
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('Agents', 'repository');
}; 