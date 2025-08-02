'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('Agents', 'demo_agent', {
    type: Sequelize.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'demo_agent'
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('Agents', 'demo_agent');
}; 