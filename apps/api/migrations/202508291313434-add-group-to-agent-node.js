'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('AgentNodes', 'group', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.removeColumn('AgentNodes', 'group');
};