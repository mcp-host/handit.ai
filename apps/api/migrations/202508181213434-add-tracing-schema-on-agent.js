'use strict';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.addColumn('Agents', 'tracing_schema', {
    type: Sequelize.JSON,
    allowNull: true,
    field: 'tracing_schema'
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('Agents', 'tracing_schema');
}; 